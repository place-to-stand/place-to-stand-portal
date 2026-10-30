import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import { sendPasswordResetEmail } from '@/lib/email/auth-emails'
import { serverEnv } from '@/lib/env.server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type Person = {
  id: string
  name: string
  email: string | null
  userId: string | null
}

async function loadPerson(contactId: string): Promise<Person | null> {
  const [person] = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      userId: contacts.userId,
    })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
    .limit(1)
  return person ?? null
}

/** Emails the person a link to set a new password (their portal's). */
export async function sendPersonPasswordReset(
  actor: AppUser,
  contactId: string
): Promise<{ error?: string }> {
  assertAdmin(actor)
  const person = await loadPerson(contactId)
  if (!person?.userId) return { error: 'They can’t sign in yet.' }

  const [signIn] = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, person.userId))
    .limit(1)
  if (!signIn) return { error: 'Their sign-in could not be found.' }

  const { data, error } =
    await getSupabaseServiceClient().auth.admin.generateLink({
      type: 'recovery',
      email: signIn.email,
    })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    console.error('Failed to generate password reset link', error)
    return { error: 'Unable to send the reset email.' }
  }

  // Client sign-ins reset on the client portal; staff on this one.
  const origin =
    signIn.role === 'CLIENT'
      ? serverEnv.CLIENT_PORTAL_URL
      : (serverEnv.APP_BASE_URL ?? 'http://localhost:3000')
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: 'recovery',
    redirect_to: '/reset-password',
  })
  await sendPasswordResetEmail(
    signIn.email,
    `${origin}/auth/confirm?${params}`,
    signIn.role === 'CLIENT' ? 'client' : 'internal'
  )
  return {}
}
