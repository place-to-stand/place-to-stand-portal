const MAX_TITLE_LENGTH = 60

/**
 * Derives a session title from its first prompt — collapse whitespace, then
 * truncate at a word boundary so it doesn't cut mid-word.
 */
export function deriveSessionTitle(message: string): string {
  const collapsed = message.trim().replace(/\s+/g, ' ')
  if (collapsed.length <= MAX_TITLE_LENGTH) return collapsed

  const truncated = collapsed.slice(0, MAX_TITLE_LENGTH)
  const lastSpace = truncated.lastIndexOf(' ')
  const cut = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated
  return `${cut}…`
}
