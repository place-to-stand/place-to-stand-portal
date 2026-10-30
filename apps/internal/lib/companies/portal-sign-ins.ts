import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactInvitedToPortalEvent } from '@/lib/activity/events/contacts'
import { userCreatedEvent } from '@/lib/activity/events/users'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'
import { setRoleTerm } from '@/lib/queries/users/role-terms'
import {
  dispatchPortalInvite,
  generateTemporaryPassword,
} from '@/lib/settings/users/user-service'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** A person on a client company who gets a CLIENT sign-in with this save. */
export type SignInRequest = {
  contactId: string
  name: string
  email: string | null
}

/**
 * A sign-in ready to be written: its auth user exists (made here, or found
 * from an earlier sign-up), its `users` row is written in the transaction.
 */
export type PreparedSignIn = {
  contactId: string
  name: string
  email: string
  userId: string
  /** This save made the auth user: delete it if the save fails. */
  createdAuthUser: boolean
  /** How the `users` row is written: inserted, restored, or already live. */
  row: 'insert' | 'restore' | 'existing'
}

const STAFF_EMAIL_ERROR = (name: string) =>
  `${name}'s email belongs to a staff sign-in, so it can't be a client sign-in. Use a different email for them.`

/**
 * Supabase Auth can't join a database transaction, so a save that gives
 * people sign-ins makes their auth users first, here. Each person needs an
 * email (it is their sign-in). An email that already signs in as a client is
 * reused; a staff one is refused. Nothing is sent: invites go out after the
 * save commits (`afterSignInsCommitted`), and a failed save deletes the auth
 * users made here (`discardPreparedSignIns`).
 */
export async function prepareClientSignIns(
  requests: SignInRequest[]
): Promise<{ ok: true; signIns: PreparedSignIn[] } | { ok: false; error: string }> {
  const missingEmail = requests.filter(request => !request.email?.trim())
  if (missingEmail.length) {
    const names = missingEmail.map(request => request.name).join(', ')
    return {
      ok: false,
      error: `Add an email to ${names} before giving ${
        missingEmail.length === 1 ? 'them' : 'each of them'
      } portal access: it is how they sign in.`,
    }
  }

  const signIns: PreparedSignIn[] = []
  const fail = async (error: string) => {
    await discardPreparedSignIns(signIns)
    return { ok: false as const, error }
  }

  for (const request of requests) {
    const email = request.email!.trim()
    const [live] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(
        and(sql`lower(${users.email}) = lower(${email})`, isNull(users.deletedAt))
      )
      .limit(1)

    if (live) {
      if (live.role !== 'CLIENT') return fail(STAFF_EMAIL_ERROR(request.name))
      const [owner] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.userId, live.id), isNull(contacts.deletedAt)))
        .limit(1)
      if (owner && owner.id !== request.contactId) {
        return fail(
          `${email} already signs in as someone else. Give ${request.name} their own email.`
        )
      }
      signIns.push({
        ...request,
        email,
        userId: live.id,
        createdAuthUser: false,
        row: 'existing',
      })
      continue
    }

    const adminClient = getSupabaseServiceClient()
    const created = await adminClient.auth.admin.createUser({
      email,
      // Never disclosed: clients sign in with the emailed link. It keeps
      // /forgot-password working for a client who later wants a password.
      password: generateTemporaryPassword(),
      email_confirm: true,
      user_metadata: {
        full_name: request.name,
        role: 'CLIENT',
        must_reset_password: true,
      },
    })

    if (created.data.user && !created.error) {
      signIns.push({
        ...request,
        email,
        userId: created.data.user.id,
        createdAuthUser: true,
        row: 'insert',
      })
      continue
    }

    if (!created.error?.message.includes('already been registered')) {
      console.error('Failed to create auth user', created.error)
      return fail(
        `Unable to create ${request.name}'s sign-in. Please try again.`
      )
    }

    // An auth user from an earlier sign-up (or a failed save) with no live
    // row: reuse it, restoring an archived client row if there is one.
    const [authRow] = await db.execute<{ id: string }>(
      sql`SELECT id FROM auth.users WHERE lower(email) = lower(${email}) LIMIT 1`
    )
    if (!authRow?.id) {
      return fail(`Unable to find ${request.name}'s existing sign-in.`)
    }
    const [archived] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, authRow.id))
      .limit(1)
    if (archived && archived.role !== 'CLIENT') {
      return fail(STAFF_EMAIL_ERROR(request.name))
    }
    signIns.push({
      ...request,
      email,
      userId: authRow.id,
      createdAuthUser: false,
      row: archived ? 'restore' : 'insert',
    })
  }

  return { ok: true, signIns }
}

/**
 * Writes the sign-ins inside the save's transaction: the `users` row, its
 * CLIENT role from this month, and the person's link to it. A person who got
 * a sign-in meanwhile throws, rolling the save back.
 */
export async function writeClientSignIns(
  tx: DbTransaction,
  actor: AppUser,
  signIns: PreparedSignIn[]
): Promise<void> {
  const now = new Date().toISOString()
  for (const signIn of signIns) {
    if (signIn.row === 'insert') {
      await tx
        .insert(users)
        .values({ id: signIn.userId, email: signIn.email, role: 'CLIENT' })
      await setRoleTerm(tx, {
        userId: signIn.userId,
        role: 'CLIENT',
        effectiveFrom: currentMonthStartUtc(),
        createdBy: actor.id,
      })
    } else if (signIn.row === 'restore') {
      await tx
        .update(users)
        .set({ deletedAt: null, updatedAt: now })
        .where(eq(users.id, signIn.userId))
    }

    const linked = await tx
      .update(contacts)
      .set({ userId: signIn.userId, updatedAt: now })
      .where(and(eq(contacts.id, signIn.contactId), isNull(contacts.userId)))
      .returning({ id: contacts.id })
    if (!linked.length) {
      throw new SignInConflictError(
        `${signIn.name} just got a sign-in elsewhere. Reload and try again.`
      )
    }
  }
}

/** A sign-in the save can't write (someone linked one meanwhile). */
export class SignInConflictError extends Error {}

/** A failed save: delete the auth users it made, so nothing is left behind. */
export async function discardPreparedSignIns(
  signIns: PreparedSignIn[]
): Promise<void> {
  const made = signIns.filter(signIn => signIn.createdAuthUser)
  if (!made.length) return
  const adminClient = getSupabaseServiceClient()
  for (const signIn of made) {
    const { error } = await adminClient.auth.admin.deleteUser(signIn.userId)
    if (error) {
      console.error('Failed to delete auth user after a failed save', error)
    }
  }
}

/**
 * After the save committed: confirm reused auth users, send each new
 * sign-in its invite (a failed send is logged, not fatal: they can ask for
 * a link on the sign-in page) and write the activity rows.
 */
export async function afterSignInsCommitted(
  actor: AppUser,
  signIns: PreparedSignIn[],
  clientId: string
): Promise<void> {
  const adminClient = getSupabaseServiceClient()
  for (const signIn of signIns) {
    if (!signIn.createdAuthUser && signIn.row !== 'existing') {
      const { error } = await adminClient.auth.admin.updateUserById(
        signIn.userId,
        {
          email_confirm: true,
          user_metadata: { full_name: signIn.name, role: 'CLIENT' },
        }
      )
      if (error) console.error('Failed to confirm reused auth user', error)
    }

    try {
      await dispatchPortalInvite({ email: signIn.email, fullName: signIn.name })
    } catch (error) {
      console.error('Failed to send portal invite', error)
    }

    if (signIn.row === 'insert') {
      const created = userCreatedEvent({
        fullName: signIn.name,
        role: 'CLIENT',
        email: signIn.email,
        clientIds: [clientId],
      })
      await logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        verb: created.verb,
        summary: created.summary,
        targetType: 'USER',
        targetId: signIn.userId,
        targetCompanyId: clientId,
        metadata: created.metadata,
      })
    }

    const invited = contactInvitedToPortalEvent({
      email: signIn.email,
      name: signIn.name,
      clientIds: [clientId],
    })
    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      verb: invited.verb,
      summary: invited.summary,
      targetType: 'CONTACT',
      targetId: signIn.contactId,
      targetCompanyId: clientId,
      metadata: invited.metadata,
    })
  }
}
