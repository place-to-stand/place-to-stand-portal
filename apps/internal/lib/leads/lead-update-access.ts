import { roleCan, type Role } from '@/lib/auth/capabilities'

/**
 * Who may edit or archive a lead update: its author, or a role that holds
 * `leads.edit_others_updates` (admins). Same rule as task comments.
 * Client-safe, so the timeline asks the question the server actions enforce.
 */
export const LEAD_UPDATE_NOT_AUTHOR_MESSAGE =
  'Only the author or an admin can change this update.'

export function canChangeLeadUpdate(
  viewer: { role: Role | null | undefined; userId: string | null | undefined },
  authorId: string | null
): boolean {
  if (roleCan(viewer.role, 'leads.edit_others_updates')) return true
  return Boolean(viewer.userId) && authorId === viewer.userId
}
