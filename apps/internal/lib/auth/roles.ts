import { roleCan, type Capability } from '@/lib/auth/capabilities'
import type { Database } from '@/lib/supabase/types'

/**
 * Role rules shared by server guards and client UI. Kept free of server-only
 * imports so components can read the same lists the guards enforce. What
 * each role may do lives in `lib/auth/capabilities.ts`; this file holds the
 * helpers built on it and the data scopes (activity types, sheet entities).
 *
 * - ADMIN: the whole internal portal.
 * - SALES: staff with CRM access (home, leads, companies, contacts and their
 *   activity) plus the task boards of projects they are members of and their
 *   own personal boards (`lib/projects/access.ts`). Everything else stays
 *   behind `requireUser()` / `assertAdmin()`, so a page or route nobody
 *   opened up for SALES is admin-only by default.
 * - CLIENT: client-portal users; never let into the internal portal.
 */
type Role = Database['public']['Enums']['user_role']

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  SALES: 'Sales',
  CLIENT: 'Client',
}

/** Where a SALES user lands after sign-in, and where admin-only pages send them. */
export const SALES_HOME_PATH = '/my/home'

/** Activity feed target types a SALES user may read. */
export const SALES_ACTIVITY_TARGET_TYPES: ReadonlySet<string> = new Set([
  'LEAD',
  'CONTACT',
  'COMPANY',
])

/** Global sheet-host entities a SALES user may open. */
export const SALES_SHEET_ENTITIES: ReadonlySet<string> = new Set([
  'lead',
  'contact',
  'company',
  // Task sheets check project membership in their own resolver.
  'task',
  // Only `?project=new`; the resolver refuses editing an existing project.
  'project',
])

export function isAdminRole(role: Role | null | undefined): boolean {
  return role === 'ADMIN'
}

export function canUseInternalPortal(role: Role | null | undefined): boolean {
  return roleCan(role, 'portal.sign_in')
}

export function homePathForRole(role: Role): string {
  return role === 'ADMIN' ? '/my/home' : SALES_HOME_PATH
}

/** Drops the nav entries (and then empty groups) a role can't open. */
export function filterNavGroupsForRole<
  G extends { items: ReadonlyArray<{ capability: Capability }> },
>(groups: readonly G[], role: Role): G[] {
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => roleCan(role, item.capability)),
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
    companyId?: string
  }
): boolean {
  if (role === 'ADMIN') return true
  if (role !== 'SALES') return false
  if (filters.projectId || filters.companyId) return false

  const types =
    typeof filters.targetType === 'string'
      ? [filters.targetType]
      : (filters.targetType ?? [])

  return (
    types.length > 0 &&
    types.every(type => SALES_ACTIVITY_TARGET_TYPES.has(type))
  )
}
