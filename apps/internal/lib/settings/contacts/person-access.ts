import type { Role } from '@/lib/auth/capabilities'

/**
 * The person sheet's Access choice: what a person can get into. It is a
 * view of the data the sheet already saves, not a field of its own:
 *
 * - No access: no live sign-in (none, or `users.disabled_at` set).
 * - Client portal: a live sign-in with role CLIENT; which client companies
 *   they see is each membership's `portal_access`.
 * - Team: a live sign-in with role ADMIN or SALES (this portal).
 *
 * Client-safe.
 */
export type AccessKind = 'none' | 'portal' | 'team'

export const ACCESS_LABELS: Record<AccessKind, string> = {
  none: 'No access',
  portal: 'Client portal',
  team: 'Team',
}

/** The Access choice for a sign-in as the form holds it. */
export function accessKindOf(
  signIn: { enabled: boolean; role: Role } | null | undefined
): AccessKind {
  if (!signIn?.enabled) return 'none'
  return signIn.role === 'CLIENT' ? 'portal' : 'team'
}

/** "Acme", "Acme and Beta", "Acme, Beta and Cobalt". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/**
 * The one plain sentence under the Access choice. `companies` is the client
 * companies they see in the portal; null when the viewer can't be shown
 * portal access (Sales), so the sentence leaves them out.
 */
export function accessSummary({
  kind,
  email,
  role,
  companies,
}: {
  kind: AccessKind
  email: string
  role: Role
  companies: readonly string[] | null
}): string {
  if (kind === 'none') return 'Can’t sign in.'
  if (kind === 'team') {
    return role === 'SALES'
      ? 'Signs in to this portal as Sales: leads, people, companies, and their own tasks and projects.'
      : 'Signs in to this portal as an Admin: everything.'
  }
  const login = `Signs in to the client portal as ${email || 'their email'}`
  if (companies === null) return `${login}.`
  return companies.length
    ? `${login} · sees ${listNames(companies)}.`
    : `${login} · sees no companies yet.`
}
