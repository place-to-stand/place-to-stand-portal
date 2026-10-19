import type { Database } from '@/lib/supabase/types'

/**
 * Role rules shared by server guards and client UI. Kept free of server-only
 * imports so components can read the same lists the guards enforce.
 *
 * - ADMIN: the whole internal portal.
 * - SALES: staff with CRM access only (leads, contacts and their activity).
 *   Everything else stays behind `requireUser()` / `assertAdmin()`, so a page
 *   or route nobody opened up for SALES is admin-only by default.
 * - CLIENT: client-portal users; never let into the internal portal.
 */
type Role = Database['public']['Enums']['user_role']

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  SALES: 'Sales',
  CLIENT: 'Client',
}

/** Roles that may sign in to the internal portal. */
export const INTERNAL_ROLES: readonly Role[] = ['ADMIN', 'SALES']

/** Where a SALES user lands after sign-in, and where admin-only pages send them. */
export const SALES_HOME_PATH = '/leads'

/** Nav entries a SALES user sees. Every other entry is admin-only. */
export const SALES_NAV_HREFS: ReadonlySet<string> = new Set([
  '/leads',
  '/contacts',
])

/** Activity feed target types a SALES user may read. */
export const SALES_ACTIVITY_TARGET_TYPES: ReadonlySet<string> = new Set([
  'LEAD',
  'CONTACT',
])

/** Global sheet-host entities a SALES user may open. */
export const SALES_SHEET_ENTITIES: ReadonlySet<string> = new Set([
  'lead',
  'contact',
])

export function isAdminRole(role: Role | null | undefined): boolean {
  return role === 'ADMIN'
}

export function canUseInternalPortal(role: Role | null | undefined): boolean {
  return !!role && INTERNAL_ROLES.includes(role)
}

export function homePathForRole(role: Role): string {
  return role === 'ADMIN' ? '/my/home' : SALES_HOME_PATH
}

/** Drops the nav entries (and then empty groups) a role can't open. */
export function filterNavGroupsForRole<
  G extends { items: ReadonlyArray<{ href: string }> },
>(groups: readonly G[], role: Role): G[] {
  if (role === 'ADMIN') return [...groups]

  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => SALES_NAV_HREFS.has(item.href)),
    }))
    .filter(group => group.items.length > 0)
}

/**
 * Whether a role may run an activity feed query with these filters. Admins
 * read everything. SALES may read only lead and contact activity, and only
 * when the query names those target types (no project or client scoping,
 * which would reach admin-only records).
 */
export function canReadActivity(
  role: Role,
  filters: {
    targetType?: string | readonly string[]
    projectId?: string
    clientId?: string
  }
): boolean {
  if (role === 'ADMIN') return true
  if (role !== 'SALES') return false
  if (filters.projectId || filters.clientId) return false

  const types =
    typeof filters.targetType === 'string'
      ? [filters.targetType]
      : (filters.targetType ?? [])

  return (
    types.length > 0 && types.every(type => SALES_ACTIVITY_TARGET_TYPES.has(type))
  )
}
