'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, threads } from '@/lib/db/schema'
import { serializeLeadNotes } from '@/lib/leads/notes'
import { resolveNextLeadRank } from '@/lib/leads/rank'
import { performLeadScoring } from '@/lib/leads/scoring'
import { revalidatePath } from 'next/cache'

const createLeadFromThreadSchema = z.object({
  threadId: z.string().uuid(),
  contactName: z.string().trim().min(1).max(160),
  contactEmail: z.string().trim().email().max(160),
  companyName: z.string().trim().max(160).nullable(),
  notes: z.string().trim().max(2000).nullable(),
})

export type CreateLeadFromThreadInput = z.infer<typeof createLeadFromThreadSchema>

export type CreateLeadFromThreadResult =
  | { success: true; leadId: string }
  | { success: false; error: string }

export async function createLeadFromThread(
  input: CreateLeadFromThreadInput
): Promise<CreateLeadFromThreadResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = createLeadFromThreadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  const { threadId, contactName, contactEmail, companyName, notes } = parsed.data
  const timestamp = new Date().toISOString()

  try {
    // Create the lead
    const rank = await resolveNextLeadRank('NEW_OPPORTUNITIES')

    const [newLead] = await db
      .insert(leads)
      .values({
        contactName,
        contactEmail: contactEmail.toLowerCase(),
        companyName,
        notes: serializeLeadNotes(notes),
        status: 'NEW_OPPORTUNITIES',
        sourceType: null,
        sourceDetail: 'Created from email thread',
        rank,
        lastContactAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: leads.id })

    if (!newLead) {
      return { success: false, error: 'Failed to create lead.' }
    }

    // Link the thread to the lead
    await db
      .update(threads)
      .set({
        leadId: newLead.id,
        updatedAt: timestamp,
      })
      .where(eq(threads.id, threadId))

    // Trigger AI scoring asynchronously (don't block)
    performLeadScoring(newLead.id).catch(err => {
      console.warn('[createLeadFromThread] Lead scoring failed:', err)
    })

    // Revalidate relevant paths
    revalidatePath('/leads')
    revalidatePath('/leads/board')
    revalidatePath('/my/inbox')

    return { success: true, leadId: newLead.id }
  } catch (error) {
    console.error('Failed to create lead from thread:', error)
    return {
      success: false,
      error: 'Unable to create lead. Please try again.',
    }
  }
}
