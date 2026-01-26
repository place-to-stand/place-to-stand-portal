'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { logActivity } from '@/lib/activity/logger'
import { leadConvertedEvent } from '@/lib/activity/events'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients, leads, threads } from '@/lib/db/schema'
import { createClient } from '@/lib/settings/clients/actions/create-client'
import { extractLeadNotes } from '@/lib/leads/notes'
import { leadConversionSchema, type LeadConversionFormValues } from '../conversion-schema'
import type { LeadConversionResult } from '../conversion-types'

export async function convertLeadToClient(
  input: LeadConversionFormValues
): Promise<LeadConversionResult> {
  const user = await requireRole('ADMIN')
  const parsed = leadConversionSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid conversion data.' }
  }

  const { leadId, clientName, clientSlug, billingType, copyNotesToClient, memberIds } = parsed.data

  // 1. Fetch the lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    return { error: 'Lead not found.' }
  }

  if (lead.convertedToClientId) {
    return { error: 'Lead already converted.' }
  }

  if (lead.status !== 'CLOSED_WON') {
    return { error: 'Only CLOSED_WON leads can be converted.' }
  }

  // 2. Create the client (reuse existing action)
  const resolvedName = clientName || lead.companyName || lead.contactName
  const resolvedNotes = copyNotesToClient
    ? extractLeadNotes(lead.notes as Record<string, unknown>)
    : null

  const clientResult = await createClient(
    { user },
    {
      name: resolvedName,
      providedSlug: clientSlug || null,
      billingType,
      notes: resolvedNotes,
      memberIds: memberIds || [],
    }
  )

  if (clientResult.error || !clientResult.clientId) {
    return { error: clientResult.error || 'Failed to create client.' }
  }

  // 3. Get the client slug for navigation
  const [createdClient] = await db
    .select({ slug: clients.slug })
    .from(clients)
    .where(eq(clients.id, clientResult.clientId))
    .limit(1)

  // 4. Update the lead with conversion info
  await db
    .update(leads)
    .set({
      convertedAt: new Date().toISOString(),
      convertedToClientId: clientResult.clientId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(leads.id, leadId))

  // 5. Transfer linked threads to client (if any)
  await db
    .update(threads)
    .set({
      clientId: clientResult.clientId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(threads.leadId, leadId))

  // 6. Log activity
  const event = leadConvertedEvent({
    leadId,
    leadName: lead.contactName,
    clientId: clientResult.clientId,
    clientName: resolvedName,
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'LEAD',
    targetId: leadId,
    metadata: event.metadata,
  })

  revalidatePath('/leads/board')
  revalidatePath('/clients')

  return {
    clientId: clientResult.clientId,
    clientSlug: createdClient?.slug ?? undefined,
  }
}
