'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const archiveLeadSchema = z.object({
  leadId: z.string().uuid(),
})

export type ArchiveLeadInput = z.infer<typeof archiveLeadSchema>

export async function archiveLead(
  input: ArchiveLeadInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = archiveLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid lead reference.',
    }
  }

  try {
    const result = await db
      .update(leads)
      .set({
        deletedAt: new Date().toISOString(),
      })
      .where(and(eq(leads.id, parsed.data.leadId), isNull(leads.deletedAt)))
      .returning({ id: leads.id })

    if (!result.length) {
      return { success: false, error: 'Lead not found.' }
    }
  } catch (error) {
    console.error('Failed to archive lead', error)
    return {
      success: false,
      error: 'Unable to archive lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}
