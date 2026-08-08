import { userRole } from '@/lib/db/schema'
import type { UserRoleValue } from '@/lib/types'

export const USER_ROLE_VALUES = userRole.enumValues

export const USER_ROLE_LABELS: Record<UserRoleValue, string> = {
  ADMIN: 'Admin',
  CLIENT: 'Client',
}

export function isUserRole(
  value: string | undefined
): value is UserRoleValue {
  return (
    typeof value === 'string' &&
    (USER_ROLE_VALUES as readonly string[]).includes(value)
  )
}

export const USER_ACCESS_VALUES = ['enabled', 'disabled'] as const

export type UserAccessFilter = (typeof USER_ACCESS_VALUES)[number]

export const USER_ACCESS_LABELS: Record<UserAccessFilter, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
}

export function isUserAccess(
  value: string | undefined
): value is UserAccessFilter {
  return (
    typeof value === 'string' &&
    (USER_ACCESS_VALUES as readonly string[]).includes(value)
  )
}

type RawSearchParams = Record<string, string | string[] | undefined>

export type UsersSearchParams = {
  cursor: string | null
  direction: 'forward' | 'backward'
  limit: number | undefined
  role: UserRoleValue | undefined
  access: UserAccessFilter | undefined
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value[0]
  }
  return undefined
}

/**
 * Shared searchParams parsing for the users settings pages (the verbose
 * cursor/dir/limit ternaries were previously duplicated verbatim across the
 * active and archive pages). Invalid role/access values fail the type guards
 * and are treated as unset, matching the submissions convention.
 */
export function parseUsersSearchParams(params: RawSearchParams): UsersSearchParams {
  const cursor = firstParam(params.cursor) ?? null
  const direction =
    firstParam(params.dir) === 'backward' ? 'backward' : ('forward' as const)
  const limitParam = Number.parseInt(firstParam(params.limit) ?? '', 10)
  const roleParam = firstParam(params.role)
  const accessParam = firstParam(params.access)

  return {
    cursor,
    direction,
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
    role: isUserRole(roleParam) ? roleParam : undefined,
    access: isUserAccess(accessParam) ? accessParam : undefined,
  }
}
