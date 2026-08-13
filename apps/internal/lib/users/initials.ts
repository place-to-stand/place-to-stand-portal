/**
 * Avatar-fallback initials for a person's display name: first + last initial,
 * or a single initial for mononyms. `?` when there's no name to work with.
 *
 * Several feature components still carry their own copy of this — this is the
 * shared one to migrate them onto.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'

  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
