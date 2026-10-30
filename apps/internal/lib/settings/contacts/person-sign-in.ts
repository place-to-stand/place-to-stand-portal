import 'server-only'

import { and, eq, isNull, ne, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import { sendPasswordResetEmail } from '@/lib/email/auth-emails'
import { serverEnv } from '@/lib/env.server'
import { promoteContactToUserMutation } from '@/lib/settings/contacts/actions'
import {
  createPortalUser,
  restorePortalUser,
  setPortalUserDisabled,
  updatePortalUser,
} from '@/lib/settings/users/services'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { USER_ROLES } from '@/lib/settings/users/user-validation'

type Role = (typeof USER_ROLES)[number]

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

/**
 * A person's sign-in from the Sign-in tab: "Can sign in" and a role. With
 * no sign-in yet, turning it on creates one for their email (Client: the
 * client portal; Admin / Sales: this portal) and emails the invite.
 */
export async function savePersonSignIn(
  actor: AppUser,
  input: { contactId: string; enabled: boolean; role: Role }
): Promise<{ error?: string }> {
  assertAdmin(actor)
  const person = await loadPerson(input.contactId)
  if (!person) return { error: 'Person not found.' }

  if (!person.userId) {
    if (!input.enabled) return {}
    if (!person.email) return { error: 'They need an email to sign in.' }

    if (input.role === 'CLIENT') {
      const result = await promoteContactToUserMutation(
        { user: actor },
        { contactId: person.id }
      )
      return result.error ? { error: result.error } : {}
    }
    // Staff: the new sign-in links to this person by email.
    const result = await createPortalUser(actor, {
      email: person.email,
      fullName: person.name,
      role: input.role,
    })
    return result.error ? { error: result.error } : {}
  }

  const [signIn] = await db
    .select({
      role: users.role,
      disabledAt: users.disabledAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, person.userId))
    .limit(1)
  if (!signIn) return { error: 'Their sign-in could not be found.' }

  const isEnabled = !signIn.disabledAt && !signIn.deletedAt
  const roleChanged = signIn.role !== input.role
  if (!roleChanged && isEnabled === input.enabled) return {}
  if (person.userId === actor.id) {
    return { error: 'You can’t change your own sign-in.' }
  }

  if (input.enabled && signIn.deletedAt) {
    const restored = await restorePortalUser(actor, { id: person.userId })
    if (restored.error) return { error: restored.error }
  }
  if (roleChanged) {
    const updated = await updatePortalUser(actor, {
      id: person.userId,
      fullName: person.name,
      role: input.role,
    })
    if (updated.error) return { error: updated.error }
  }
  // Switch the off switch only when it differs (an archived sign-in that
  // stays off needs nothing).
  const isDisabled = Boolean(signIn.disabledAt)
  if (isDisabled === input.enabled && !(signIn.deletedAt && !input.enabled)) {
    const access = await setPortalUserDisabled(actor, {
      id: person.userId,
      disabled: !input.enabled,
    })
    if (access.error) return { error: access.error }
  }
  return {}
}

/**
 * A sign-in uses the person's email: after an admin changes it, the login
 * follows (auth and the sign-in row). Refuses an email another sign-in has.
 */
export async function syncSignInEmail(
  actor: AppUser,
  contactId: string
): Promise<{ error?: string }> {
  assertAdmin(actor)
  const person = await loadPerson(contactId)
  if (!person?.userId) return {}
  if (!person.email) {
    return { error: 'Someone who can sign in needs an email.' }
  }

  const [signIn] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, person.userId))
    .limit(1)
  if (!signIn || signIn.email.toLowerCase() === person.email.toLowerCase()) {
    return {}
  }

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        ne(users.id, person.userId),
        sql`lower(${users.email}) = lower(${person.email})`
      )
    )
    .limit(1)
  if (taken) {
    return { error: 'Another sign-in already uses that email.' }
  }

  const { error } = await getSupabaseServiceClient().auth.admin.updateUserById(
    person.userId,
    { email: person.email, email_confirm: true }
  )
  if (error) {
    console.error('Failed to change sign-in email', error)
    return { error: 'Saved, but their sign-in email could not be changed.' }
  }
  await db
    .update(users)
    .set({ email: person.email, updatedAt: new Date().toISOString() })
    .where(eq(users.id, person.userId))
  return {}
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
  await sendPasswordResetEmail(signIn.email, `${origin}/auth/confirm?${params}`)
  return {}
}
