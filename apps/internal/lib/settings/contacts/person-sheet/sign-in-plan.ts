import 'server-only'

import { and, eq, isNull, ne, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'
import { listClosedMonthStarts } from '@/lib/queries/reports/close-snapshots'
import { roleMonthError } from '@/lib/settings/users/role-months'

import type { ExistingContact } from '../actions/save-contact'

export type Role = 'ADMIN' | 'SALES' | 'CLIENT'

/** The sheet's Sign-in fields, sent only when an admin changed them. */
export type SignInInput = {
  enabled: boolean
  role: Role
  /** Month start the role takes effect from (role changes only). */
  effectiveFrom?: string | null
}

export type CurrentSignIn = {
  id: string
  email: string
  role: Role
  disabledAt: string | null
  deletedAt: string | null
}

/**
 * What a Save does to a person's sign-in. Worked out before anything is
 * written; the auth steps then fill in `userId` for a new sign-in.
 */
export type SignInPlan = {
  userId: string | null
  /** A sign-in to add: a new account, or an existing one found by email. */
  create: {
    email: string
    role: Role
    /** new: create the auth user; auth: one exists with no sign-in row; user: a sign-in row exists. */
    source: 'new' | 'auth' | 'user'
    temporaryPassword: string | null
  } | null
  /** Their sign-in before the save (also an existing one being linked). */
  current: CurrentSignIn | null
  roleChange: { role: Role; effectiveFrom: string } | null
  /** Turning sign-in on (true) or off (false); null when unchanged. */
  enable: boolean | null
  restore: boolean
  emailChange: { from: string; to: string } | null
}

async function loadSignIn(where: SQL) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      disabledAt: users.disabledAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(where)
    .limit(1)
  return row ?? null
}

async function roleChangeError(effectiveFrom: string) {
  return roleMonthError(
    effectiveFrom,
    currentMonthStartUtc(),
    await listClosedMonthStarts()
  )
}

/**
 * Validates the sign-in half of a Save (admins only) and works out what it
 * changes. An email change on someone with a sign-in moves their login too.
 * Null when the save leaves their sign-in alone.
 */
export async function prepareSignIn(
  actor: AppUser,
  input: {
    existing: ExistingContact | null
    nextEmail: string | null
    signIn: SignInInput | undefined
  }
): Promise<{ error: string } | { plan: SignInPlan | null }> {
  const { existing, nextEmail, signIn } = input

  if (existing?.userId) {
    const current = await loadSignIn(eq(users.id, existing.userId))
    if (!current) return { error: 'Their sign-in could not be found.' }

    let emailChange: SignInPlan['emailChange'] = null
    if ((nextEmail ?? '').toLowerCase() !== current.email.toLowerCase()) {
      if (!nextEmail) return { error: 'Someone who can sign in needs an email.' }
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            ne(users.id, current.id),
            sql`lower(${users.email}) = lower(${nextEmail})`
          )
        )
        .limit(1)
      if (taken) return { error: 'Another sign-in already uses that email.' }
      emailChange = { from: current.email, to: nextEmail }
    }

    const isEnabled = !current.disabledAt && !current.deletedAt
    const enable =
      signIn && signIn.enabled !== isEnabled ? signIn.enabled : null
    let roleChange: SignInPlan['roleChange'] = null
    if (signIn && signIn.role !== current.role) {
      const effectiveFrom = signIn.effectiveFrom || currentMonthStartUtc()
      const monthError = await roleChangeError(effectiveFrom)
      if (monthError) return { error: monthError }
      roleChange = { role: signIn.role, effectiveFrom }
    }
    if ((enable !== null || roleChange) && current.id === actor.id) {
      return { error: 'You can’t change your own sign-in.' }
    }
    if (!emailChange && enable === null && !roleChange) return { plan: null }
    return {
      plan: {
        userId: current.id,
        create: null,
        current,
        roleChange,
        enable,
        restore: enable === true && Boolean(current.deletedAt),
        emailChange,
      },
    }
  }

  if (!signIn?.enabled) return { plan: null }
  if (!nextEmail) return { error: 'They need an email to sign in.' }

  // A sign-in row with this email and no person (left behind by an
  // archive or an earlier failure) is linked, not duplicated.
  const found = await loadSignIn(sql`lower(${users.email}) = lower(${nextEmail})`)
  if (found) {
    const [owner] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.userId, found.id), isNull(contacts.deletedAt)))
      .limit(1)
    if (owner && owner.id !== existing?.id) {
      return { error: 'Another person already signs in with that email.' }
    }
  }
  return {
    plan: {
      userId: found?.id ?? null,
      create: {
        email: nextEmail,
        role: signIn.role,
        source: found ? 'user' : 'new',
        temporaryPassword: null,
      },
      current: found,
      roleChange:
        !found || found.role !== signIn.role
          ? { role: signIn.role, effectiveFrom: currentMonthStartUtc() }
          : null,
      enable: true,
      restore: Boolean(found?.deletedAt),
      emailChange: null,
    },
  }
}
