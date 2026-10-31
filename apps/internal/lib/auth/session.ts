import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { and, eq, isNull } from 'drizzle-orm'

import type { Database } from '@/lib/supabase/types'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { ensureUserProfile } from '@/lib/auth/profile'
import { serverEnv } from '@/lib/env.server'
import { roleCan } from '@/lib/auth/capabilities'
import { SALES_HOME_PATH } from '@/lib/auth/roles'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'
import { roleAsOfSql } from '@/lib/queries/users/role-terms'
import { applyDueRoleTerms } from '@/lib/settings/users/services/role'

/**
 * The signed-in person: their sign-in row plus their name and photo, which
 * live on the person (contacts) since 0109 and 0112.
 */
export type AppUser = Database['public']['Tables']['users']['Row'] & {
  full_name: string | null
  avatar_url: string | null
}
export type UserRole = Database['public']['Enums']['user_role']

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.getSession()

  // AuthSessionMissingError is expected for unauthenticated users - don't log it
  if (error && error.name !== 'AuthSessionMissingError') {
    console.error('Failed to resolve Supabase session', error)
  }

  if (error) {
    return null
  }

  return data.session ?? null
})

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = getSupabaseServerClient()

  // getClaims() verifies the session JWT's signature and expiry. With the
  // project on asymmetric signing keys (ES256) that happens in-process against
  // a JWKS cached for 10 minutes — no round trip to Supabase Auth per request.
  // With the legacy HS256 secret it falls back to getUser() internally, so
  // behaviour is unchanged until the key is rotated. The only claims trusted
  // here are `sub` and `email`; role, disabled and deleted state come from our
  // own users row below, on every request.
  const { data, error } = await supabase.auth.getClaims()

  // AuthSessionMissingError is expected for unauthenticated users - don't log it
  if (error && error.name !== 'AuthSessionMissingError') {
    console.error('Failed to resolve Supabase session', error)
  }

  const authUserId = data?.claims.sub
  if (error || !authUserId) {
    return null
  }

  try {
    const profile = await fetchUserProfile(authUserId)

    if (!profile) {
      return null
    }

    // A scheduled role change has come into force: apply it before
    // trusting the role (the daily cron does the same for everyone).
    if (profile.roleInForce && profile.roleInForce !== profile.role) {
      await applyDueRoleTerms(authUserId)
      const updated = await fetchUserProfileUncached(authUserId)
      return updated ? mapProfileToAppUser(updated) : null
    }

    // Sync profile if Supabase auth email differs from database email
    // This handles cases where email change confirmation bypassed our /auth/confirm route
    const authEmail = data.claims.email ?? ''
    if (authEmail && authEmail.toLowerCase() !== profile.email.toLowerCase()) {
      // Rare path, so the full auth user is fetched only here.
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (authUser) {
        await syncUserProfile(authUser, profile.email)
      }
      // Re-fetch to get updated email
      const updatedProfile = await fetchUserProfileUncached(authUserId)
      if (updatedProfile) {
        return mapProfileToAppUser(updatedProfile)
      }
    }

    return mapProfileToAppUser(profile)
  } catch (profileError) {
    console.error('Failed to load current user from Drizzle', profileError)
    return null
  }
})

/**
 * The signed-in ADMIN or SALES user, or null. For API routes on the task-board
 * surfaces opened to project members; pair with the guards in
 * `lib/projects/access.ts`.
 */
export const getCurrentStaff = async (): Promise<AppUser | null> => {
  const user = await getCurrentUser()
  return roleCan(user?.role, 'portal.sign_in') ? user : null
}

/**
 * The signed-in user when they are an ADMIN, else null. For API routes that
 * answer 401 themselves rather than redirecting: the internal portal also
 * admits SALES (CRM staff), so "has a session" no longer means "is an admin".
 */
export const getCurrentAdmin = async (): Promise<AppUser | null> => {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN' ? user : null
}

type UserProfile = {
  id: string
  email: string
  fullName: string | null
  role: UserRole
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  disabledAt: string | null
  onboardingCompletedAt: string | null
}

async function fetchUserProfile(
  userId: string
): Promise<(UserProfile & { roleInForce: string | null }) | null> {
  const profileRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: personNameSql,
      role: users.role,
      // A role change dated this month or earlier that users.role hasn't
      // caught up with yet (see applyDueRoleTerms).
      roleInForce: roleAsOfSql(currentMonthStartUtc()),
      avatarUrl: personAvatarSql,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
      disabledAt: users.disabledAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        isNull(users.deletedAt),
        // Disabled users are rejected on every request, which also ends any
        // session that existed before the account was disabled.
        isNull(users.disabledAt)
      )
    )
    .limit(1)

  return profileRows[0] ?? null
}

async function fetchUserProfileUncached(userId: string): Promise<UserProfile | null> {
  // Direct query without React cache to get fresh data after sync
  const profileRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: personNameSql,
      role: users.role,
      avatarUrl: personAvatarSql,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
      disabledAt: users.disabledAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        isNull(users.deletedAt),
        // Disabled users are rejected on every request, which also ends any
        // session that existed before the account was disabled.
        isNull(users.disabledAt)
      )
    )
    .limit(1)

  return profileRows[0] ?? null
}

/**
 * Resolve an AppUser straight from a user id, skipping the cookie-backed
 * Supabase session entirely. Callers that authenticate by some other means —
 * the CLI's bearer token, for one — need the same profile row and the same
 * disabled/deleted filtering without a request-scoped session to read from.
 */
export async function loadAppUserById(userId: string): Promise<AppUser | null> {
  const profile = await fetchUserProfile(userId)

  if (!profile) {
    return null
  }

  // Same as getCurrentUser: a scheduled role change that has come into
  // force is applied before the role is trusted.
  if (profile.roleInForce && profile.roleInForce !== profile.role) {
    await applyDueRoleTerms(userId)
    const updated = await fetchUserProfileUncached(userId)
    return updated ? mapProfileToAppUser(updated) : null
  }

  return mapProfileToAppUser(profile)
}

function mapProfileToAppUser(profile: UserProfile): AppUser {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    avatar_url: profile.avatarUrl ?? null,
    full_name: profile.fullName ?? null,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    deleted_at: profile.deletedAt ?? null,
    disabled_at: profile.disabledAt ?? null,
    onboarding_completed_at: profile.onboardingCompletedAt ?? null,
  }
}

async function syncUserProfile(authUser: User, previousEmail: string): Promise<void> {
  try {
    console.log(`Syncing user profile: email changed from ${previousEmail} to ${authUser.email}`)
    const result = await ensureUserProfile(authUser)

    // Log only — never sign out mid-request. This runs while rendering an
    // authenticated page, and the caller only reaches it after loading a profile
    // row, so 'not_provisioned' here means the row vanished underneath us.
    if (result === 'not_provisioned') {
      console.error('User profile disappeared during email-change sync', {
        userId: authUser.id,
      })
    }
  } catch (syncError) {
    console.error('Failed to sync user profile after email change', syncError)
  }
}

export const requireUser = async () => {
  const user = await getCurrentUser()

  if (!user) {
    // A session with no active user: sign it out, or /sign-in bounces back.
    redirect('/auth/sign-out')
  }

  // Admin-only by default. SALES staff get only the CRM pages, which call
  // `requireCrmUser()` instead; anywhere else sends them to their home page.
  if (user.role === 'SALES') {
    redirect(SALES_HOME_PATH)
  }

  // Portal (CLIENT) users belong in the client portal — send any lingering
  // session there rather than to a 403.
  if (user.role !== 'ADMIN') {
    redirect(serverEnv.CLIENT_PORTAL_URL)
  }

  return user
}

/**
 * Guard for the CRM pages (leads, contacts) and the dashboard shell: admits
 * ADMIN and SALES. Use `requireUser()` for everything else.
 */
export const requireCrmUser = async () => {
  const user = await getCurrentUser()

  if (!user) {
    // A session with no active user: sign it out, or /sign-in bounces back.
    redirect('/auth/sign-out')
  }

  if (!roleCan(user.role, 'portal.sign_in')) {
    redirect(serverEnv.CLIENT_PORTAL_URL)
  }

  return user
}

/**
 * Guard for the task-board surfaces opened to project members (boards, task
 * sheet, My tasks): admits ADMIN and SALES. It does NOT check project access;
 * pair it with `ensureProjectWorkAccess` / `ensureTaskWorkAccess` or a query
 * scoped by `listWorkableProjectIds`.
 */
export const requireStaffUser = requireCrmUser

export const requireRole = async (allowed: UserRole | UserRole[]) => {
  const user = await requireUser()
  const roles = Array.isArray(allowed) ? allowed : [allowed]

  if (!roles.includes(user.role)) {
    redirect('/unauthorized')
  }

  return user
}
