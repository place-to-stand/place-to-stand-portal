'use server'

import { z } from 'zod'

import type { SetAssigneeResult } from '@/lib/assignees/types'
import { assertCrmAccess } from '@/lib/auth/permissions'
import { requireCrmUser } from '@/lib/auth/session'
import { revalidateLeadsPath } from '@/lib/leads/revalidate'
import { setLeadAssigneeForActor } from '@/lib/leads/set-lead-assignee'

const schema = z.object({
  leadId: z.uuid(),
  assigneeId: z.uuid().nullable(),
})

/** The lead right-click menu's "Set assignee" (null clears it). */
export async function setLeadAssignee(input: {
  leadId: string
  assigneeId: string | null
}): Promise<SetAssigneeResult> {
  const user = await requireCrmUser()
  assertCrmAccess(user)

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid assignee update.' }
  }

  const result = await setLeadAssigneeForActor(
    user,
    parsed.data.leadId,
    parsed.data.assigneeId,
    'ADMIN_UI'
  )
  if (result.ok) revalidateLeadsPath()
  return result
}
