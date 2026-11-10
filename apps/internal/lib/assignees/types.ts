/** One person a record can be assigned to, as the right-click menu lists them. */
export type AssigneeOption = {
  id: string
  name: string
  /** Set when the person has a photo; the menu loads it by user id. */
  avatarUrl: string | null
}

/** What a quick assignee change returns to the menu. */
export type SetAssigneeResult = { ok: true } | { ok: false; error: string }
