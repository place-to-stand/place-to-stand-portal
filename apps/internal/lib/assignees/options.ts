import 'server-only'

import { fetchCrmUsers } from '@/lib/data/users'
import { findBlockedAssignees } from '@/lib/projects/access'
import type { DbUser } from '@/lib/types'
import { isSelectableUser } from '@/lib/users/selectable'

import type { AssigneeOption } from './types'

const toOption = (user: DbUser): AssigneeOption => ({
  id: user.id,
  name: user.full_name?.trim() || user.email,
  avatarUrl: user.avatar_url ?? null,
})

/** Who can take a lead: live, enabled admins and Sales staff. */
export async function loadLeadAssigneeOptions(): Promise<AssigneeOption[]> {
  const staff = await fetchCrmUsers()
  return staff.filter(isSelectableUser).map(toOption)
}

/**
 * Who can take a task in `projectId` (null for a lead's task): the staff a
 * task save would accept, by the same rule (`findBlockedAssignees`).
 */
export async function loadTaskAssigneeOptions(
  projectId: string | null
): Promise<AssigneeOption[]> {
  const staff = (await fetchCrmUsers()).filter(isSelectableUser)
  if (!staff.length) return []

  const blocked = new Set(
    (
      await findBlockedAssignees(
        projectId,
        staff.map(user => user.id)
      )
    ).map(person => person.id)
  )
  return staff.filter(user => !blocked.has(user.id)).map(toOption)
}
