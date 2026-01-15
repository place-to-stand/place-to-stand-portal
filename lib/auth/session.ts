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
import { CONVEX_FLAGS } from '@/lib/feature-flags'

export type AppUser = Database['public']['Tables']['users']['Row']
export type UserRole = Database['public']['Enums']['user_role']

// ============================================================
// CONVEX AUTH INTEGRATION
// ============================================================

/**
 * Safely convert a timestamp to ISO string
 * Returns current time if the timestamp is invalid
 */
function safeTimestampToISO(timestamp: number | undefined | null): string {
  if (timestamp === undefined || timestamp === null || !Number.isFinite(timestamp)) {
    return new Date().toISOString()
  }
  try {
    return new Date(timestamp).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

/**
 * Maps a Convex user to the AppUser type for compatibility
 *
 * IMPORTANT: During the migration period, we use `supabaseId` as the `id` field
 * when available. This ensures PostgreSQL queries (via Drizzle) continue to work
 * with the existing UUID-based foreign keys in the database.
 *
 * Once the full migration to Convex is complete, this can be simplified to
 * always use `_id` (the Convex ID).
 */
async function mapConvexUserToAppUser(convexUser: ConvexUserDoc): Promise<AppUser> {
  // Debug logging to understand the user document structure
  console.log('[Convex Auth] Mapping user document:', JSON.stringify(convexUser, null, 2))

  // Ensure required fields exist with fallbacks
  const email = convexUser.email ?? 'unknown@example.com'
  const role = (convexUser.role as UserRole) ?? 'CLIENT'

  // Use supabaseId for PostgreSQL compatibility, fall back to Convex _id for new users
  const id = convexUser.supabaseId ?? convexUser._id

  return {
    id,
    email,
    role,
    avatar_url: convexUser.avatarUrl ?? null,
    full_name: convexUser.fullName ?? null,
    created_at: safeTimestampToISO(convexUser.createdAt),
    updated_at: safeTimestampToISO(convexUser.updatedAt),
    deleted_at: convexUser.deletedAt
      ? safeTimestampToISO(convexUser.deletedAt)
      : null,
  }
}

/**
 * Convex user document type (minimal for mapping)
 * Field names match the Convex schema (convex/schema.ts)
 */
type ConvexUserDoc = {
  _id: string
  email: string
  fullName?: string // Matches Convex schema field name
  role: string
  avatarUrl?: string // Matches Convex schema field name
  createdAt: number
  updatedAt: number
  deletedAt?: number
  // Migration field - Supabase UUID for backward compatibility with PostgreSQL queries
  supabaseId?: string
}

/**
 * Lazy import for Convex session to avoid loading when not needed
 */
async function getConvexSession() {
  const { getConvexCurrentUser, requireConvexUser, requireConvexRole } =
    await import('@/lib/auth/convex-session')
  return { getConvexCurrentUser, requireConvexUser, requireConvexRole }
}

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
  // Use Convex Auth if enabled
  if (CONVEX_FLAGS.AUTH) {
    try {
      const { getConvexCurrentUser } = await getConvexSession()
      const convexUser = await getConvexCurrentUser()
      if (!convexUser) {
        return null
      }
      return mapConvexUserToAppUser(convexUser as unknown as ConvexUserDoc)
    } catch (error) {
      console.error('Failed to get Convex user', error)
      return null
    }
  }

  // Supabase Auth (default)
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
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
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
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  return profileRows[0] ?? null
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
    await ensureUserProfile(authUser)
  } catch (syncError) {
    console.error('Failed to sync user profile after email change', syncError)
  }
}

export const requireUser = async () => {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
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
