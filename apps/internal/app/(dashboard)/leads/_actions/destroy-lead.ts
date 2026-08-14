'use server'

import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, tasks } from '@/lib/db/schema'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const destroyLeadSchema = z.object({
  leadId: z.string().uuid(),
})

export type DestroyLeadInput = z.infer<typeof destroyLeadSchema>

export async function destroyLead(
  input: DestroyLeadInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = destroyLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid lead reference.',
    }
  }

  try {
    const result = await db.transaction(async tx => {
      // `tasks_lead_id_fkey` is ON DELETE SET NULL, so hard-deleting the lead
      // would null `lead_id` on its tasks. A lead-anchored task has no project
      // to fall back on, so it would end up with NO anchor — tripping
      // `tasks_anchor_present` and failing the whole delete with an opaque
      // constraint error (W20).
      //
      // Soft-deleting them first does NOT help: the CHECK is row-level and
      // ignores `deleted_at`, so the FK's SET NULL still leaves an anchorless
      // row. (Verified against the database — both variants raise
      // `tasks_anchor_present`.) The lead-only tasks have to go.
      //
      // That matches the semantics of this action: it is the archive's
      // permanent-destroy path, the lead is being removed forever, and a
      // lead-only task has no other home to survive into. Project tasks that
      // merely REFERENCE this lead keep their project anchor and are left
      // alone — which is exactly why the FK is SET NULL rather than CASCADE.
      await tx
        .delete(tasks)
        .where(
          and(eq(tasks.leadId, parsed.data.leadId), isNull(tasks.projectId))
        )

      return tx
        .delete(leads)
        .where(
          and(eq(leads.id, parsed.data.leadId), isNotNull(leads.deletedAt))
        )
        .returning({ id: leads.id })
    })

    if (!result.length) {
      return { success: false, error: 'Lead not found in archive.' }
    }
  } catch (error) {
    console.error('Failed to permanently delete lead', error)
    return {
      success: false,
      error: 'Unable to delete lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}
