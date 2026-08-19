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

export type AppUser = Database['public']['Tables']['users']['Row']
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
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser()

  // AuthSessionMissingError is expected for unauthenticated users - don't log it
  if (error && error.name !== 'AuthSessionMissingError') {
    console.error('Failed to resolve Supabase user', error)
  }

  if (error) {
    return null
  }

  if (!authUser?.id) {
    return null
  }

  try {
    const profile = await fetchUserProfile(authUser.id)

    if (!profile) {
      return null
    }

    // Sync profile if Supabase auth email differs from database email
    // This handles cases where email change confirmation bypassed our /auth/confirm route
    const authEmail = authUser.email ?? ''
    if (authEmail && authEmail.toLowerCase() !== profile.email.toLowerCase()) {
      await syncUserProfile(authUser, profile.email)
      // Re-fetch to get updated email
      const updatedProfile = await fetchUserProfileUncached(authUser.id)
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

type UserProfile = {
  id: string
  email: string
  fullName: string | null
  role: UserRole
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const profileRows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
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
      fullName: users.fullName,
      role: users.role,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
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
  const profile = await fetchUserProfileUncached(userId)

  return profile ? mapProfileToAppUser(profile) : null
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
    redirect('/sign-in')
  }

  // The internal portal is admin-only. Portal (CLIENT) users belong in the
  // client portal — send any lingering session there rather than to a 403.
  if (user.role !== 'ADMIN') {
    redirect(serverEnv.CLIENT_PORTAL_URL)
  }

  return user
}

export const requireRole = async (allowed: UserRole | UserRole[]) => {
  const user = await requireUser()
  const roles = Array.isArray(allowed) ? allowed : [allowed]

  if (!roles.includes(user.role)) {
    redirect('/unauthorized')
  }

  return user
}
