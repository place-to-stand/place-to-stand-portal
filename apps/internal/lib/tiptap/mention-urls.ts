/**
 * Where an editor's `@` list comes from, by what the text belongs to. A task
 * follows its home (project or lead), so moving it changes who can be named.
 */
export function taskMentionOptionsUrl(home: {
  projectId?: string | null
  leadId?: string | null
}): string | undefined {
  if (home.projectId) return `/api/mention-options?projectId=${home.projectId}`
  if (home.leadId) return `/api/mention-options?leadTaskId=${home.leadId}`
  return undefined
}

/** A lead's notes and updates: every admin and Sales person, on any lead. */
export const LEAD_MENTION_OPTIONS_URL = '/api/mention-options?lead'
