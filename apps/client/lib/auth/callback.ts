import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@pts/db/schema'

/**
 * Invite-only: authenticating does not earn an account. Portal access is granted
 * by an admin promoting a contact, which inserts this row.
 *
 * The `deletedAt` / `disabledAt` filters mirror `lib/auth/session.ts` exactly.
 * Without them a disabled user exchanges a code, passes the callback, then gets
 * rejected on the next request — a confusing half-signed-in state.
 *
 * Deliberately read-only. `ensureUserProfile` lives in the internal app and the
 * portal has no reason to write to `users`.
 */
export async function hasPortalProfile(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        isNull(users.deletedAt),
        isNull(users.disabledAt)
      )
    )
    .limit(1)

  return Boolean(profile)
}

/** Relative paths only — blocks an open redirect via `?redirect_to=//evil.com`. */
export function safeRedirectPath(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

/**
 * Only the types we actually issue. Supabase's `verifyOtp` accepts more, but
 * passing an arbitrary `?type=` through from the query string lets a caller pick
 * which verification path runs.
 */
const SUPPORTED_OTP_TYPES = ['magiclink', 'email', 'recovery', 'invite'] as const

export type SupportedOtpType = (typeof SUPPORTED_OTP_TYPES)[number]

export function isSupportedOtpType(value: string): value is SupportedOtpType {
  return (SUPPORTED_OTP_TYPES as readonly string[]).includes(value)
}
