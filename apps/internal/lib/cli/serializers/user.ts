import type { AppUser } from '@/lib/auth/session'

/**
 * Serializers exist so the CLI contract is stated once, explicitly, in
 * camelCase — rather than leaking whatever shape a query happens to return
 * today. Agents hardcode these field names, so changing one is a breaking
 * change; adding one is not.
 *
 * `AppUser` is a Supabase-generated row type and is snake_case at source.
 */
export type CliUser = {
  id: string
  email: string
  fullName: string | null
  role: AppUser['role']
}

export function serializeUser(user: AppUser): CliUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  }
}

export type CliUserRow = CliUser & {
  avatarUrl: string | null
  createdAt: string
}

/**
 * Users listed from the database, as opposed to the resolved session user
 * `serializeUser` handles. Both keep the same core field names.
 */
export function serializeUserRow(user: {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  role: CliUser['role']
  createdAt: string
}): CliUserRow {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  }
}
