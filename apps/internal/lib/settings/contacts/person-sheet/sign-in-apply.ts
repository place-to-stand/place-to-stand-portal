import 'server-only'

import { and, eq, gt, isNull, sql } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { contactInvitedToPortalEvent } from '@/lib/activity/events/contacts'
import {
  userCreatedEvent,
  userRestoredEvent,
  userUpdatedEvent,
} from '@/lib/activity/events/users'
import type { AppUser } from '@/lib/auth/session'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { db } from '@/lib/db'
import {
  clientPortalAccess,
  contacts,
  userRoleTerms,
  users,
} from '@/lib/db/schema'
import { revokeUserOauthConnections } from '@/lib/oauth/revoke-user-connections'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'
import { setRoleTerm } from '@/lib/queries/users/role-terms'
import {
  createAuthUser,
  deleteAuthUser,
  sendSignInInvite,
  setAuthBanned,
} from '@/lib/settings/users/services'
import {
  applyRoleInForce,
  type RoleChange,
} from '@/lib/settings/users/services/role'
import { monthLabel } from '@/lib/settings/users/role-months'
import { dispatchPortalInvite } from '@/lib/settings/users/user-service'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

import { sendPersonPasswordReset } from '../person-sign-in'
import type { SignInPlan } from './sign-in-plan'
import type { Undo } from './undo'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function setAuthEmail(userId: string, email: string) {
  const { error } = await getSupabaseServiceClient().auth.admin.updateUserById(
    userId,
    { email, email_confirm: true }
  )
  if (error) console.error('Failed to change sign-in email', error)
  return error ? 'Their sign-in email could not be changed.' : null
}

/**
 * The Supabase Auth half of a sign-in change, before the transaction
 * (auth can't join it). Each step registers its undo, run if the
 * transaction fails. Returns an error message, or null.
 */
export async function runSignInAuth(
  plan: SignInPlan,
  fullName: string,
  undo: Undo
): Promise<string | null> {
  const { create } = plan
  if (create?.source === 'new') {
    const created = await createAuthUser({
      email: create.email,
      fullName,
      role: create.role,
    })
    if ('error' in created) {
      if (!created.alreadyRegistered) return created.error
      // An auth user with no sign-in row: use it.
      const [authRow] = await db.execute<{ id: string }>(
        sql`SELECT id FROM auth.users WHERE lower(email) = lower(${create.email}) LIMIT 1`
      )
      if (!authRow?.id) return 'Unable to find the existing sign-in.'
      plan.userId = authRow.id
      create.source = 'auth'
    } else {
      plan.userId = created.userId
      create.temporaryPassword = created.temporaryPassword
      const userId = created.userId
      undo.push(() => deleteAuthUser(userId))
    }
  }

  const userId = plan.userId
  if (!userId) return null

  if (plan.emailChange) {
    const { from, to } = plan.emailChange
    const error = await setAuthEmail(userId, to)
    if (error) return error
    undo.push(async () => {
      await setAuthEmail(userId, from)
    })
  }

  // Turning on lifts the auth ban (a sign-in found by email may have one);
  // turning off sets it. Both are undone if the save fails.
  const wasBlocked = Boolean(
    plan.current?.disabledAt || plan.current?.deletedAt
  )
  if (plan.enable === true && (wasBlocked || plan.create?.source === 'auth')) {
    const error = await setAuthBanned(userId, false)
    if (error) return error
    if (wasBlocked)
      undo.push(async () => void (await setAuthBanned(userId, true)))
  }
  if (plan.enable === false) {
    const error = await setAuthBanned(userId, true)
    if (error) return 'Unable to turn their sign-in off. Try again.'
    undo.push(async () => void (await setAuthBanned(userId, false)))
  }
  return null
}

/** The sign-in rows, inside the Save's transaction. */
export async function writeSignIn(
  tx: Tx,
  actor: AppUser,
  plan: SignInPlan,
  contactId: string
): Promise<RoleChange | null> {
  const userId = plan.userId
  if (!userId) throw new Error('The sign-in was not created.')
  const now = new Date().toISOString()

  if (plan.create && plan.create.source !== 'user') {
    await tx.insert(users).values({
      id: userId,
      email: plan.create.email,
      role: plan.create.role,
    })
  } else {
    const patch: Partial<typeof users.$inferInsert> = {}
    if (plan.emailChange) patch.email = plan.emailChange.to
    if (plan.enable === true) patch.disabledAt = null
    if (plan.enable === false) patch.disabledAt = now
    if (plan.restore) patch.deletedAt = null
    if (Object.keys(patch).length) {
      await tx
        .update(users)
        .set({ ...patch, updatedAt: now })
        .where(eq(users.id, userId))
    }
  }

  if (plan.create) {
    const linked = await tx
      .update(contacts)
      .set({ userId, updatedAt: now })
      .where(and(eq(contacts.id, contactId), isNull(contacts.userId)))
      .returning({ id: contacts.id })
    if (!linked.length) throw new Error('This person already has a sign-in.')
  }

  if (plan.roleChange) {
    const { role, effectiveFrom } = plan.roleChange
    // A role from a month on replaces any later term (a backdated change
    // isn't overtaken by an older edit; a scheduled one is superseded).
    // prepareSignIn checked none of those months is closed.
    await tx
      .update(userRoleTerms)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(userRoleTerms.userId, userId),
          gt(userRoleTerms.effectiveFrom, effectiveFrom),
          isNull(userRoleTerms.deletedAt)
        )
      )
    await setRoleTerm(tx, {
      userId,
      role,
      effectiveFrom,
      createdBy: actor.id,
    })
  }
  if (!plan.roleChange && !plan.create) return null
  // users.role follows the term in force now; a change dated next month
  // waits for it (applyDueRoleTerms). A sign-in new to this person joins
  // the staff company if it's staff.
  return applyRoleInForce(tx, {
    userId,
    contactId,
    previousRole: plan.create ? null : (plan.current?.role ?? null),
  })
}

/**
 * After commit: the invite for a new sign-in, ending provider connections
 * for one turned off, and the activity rows. Returns a warning when the
 * save stands but a follow-up didn't happen.
 */
export async function finishSignIn(
  actor: AppUser,
  plan: SignInPlan,
  person: { contactId: string; name: string }
): Promise<string | null> {
  const userId = plan.userId!
  let warning: string | null = null

  if (plan.create) {
    const { email, role, temporaryPassword } = plan.create
    try {
      if (temporaryPassword) {
        await sendSignInInvite({
          email,
          fullName: person.name,
          role,
          temporaryPassword,
        })
      } else if (role === 'CLIENT') {
        await dispatchPortalInvite({ email, fullName: person.name })
      } else {
        const reset = await sendPersonPasswordReset(actor, person.contactId)
        if (reset.error) throw new Error(reset.error)
      }
    } catch (error) {
      console.error('Failed to send the sign-in invite', error)
      warning =
        'Their sign-in is ready, but the invite email didn’t send. Use Send password reset.'
    }
  }
  if (plan.enable === false) {
    try {
      await revokeUserOauthConnections(userId)
    } catch (error) {
      console.error('Failed to revoke provider connections', error)
      warning =
        'Sign-in turned off, but their connected accounts couldn’t be disconnected.'
    }
  }

  await logSignInChanges(actor, plan, person)
  return warning
}

async function logSignInChanges(
  actor: AppUser,
  plan: SignInPlan,
  person: { contactId: string; name: string }
) {
  const userId = plan.userId!
  const base = {
    actorId: actor.id,
    actorRole: actor.role,
    targetType: 'USER' as const,
    targetId: userId,
  }

  if (plan.create && plan.create.source !== 'user') {
    const event = userCreatedEvent({
      fullName: person.name,
      role: plan.create.role,
      email: plan.create.email,
    })
    await logActivity({
      ...base,
      verb: event.verb,
      summary: event.summary,
      metadata: event.metadata,
    })
    if (plan.create.role === 'CLIENT') {
      const clients = await db
        .select({ id: clientPortalAccess.companyId })
        .from(clientPortalAccess)
        .where(eq(clientPortalAccess.contactId, person.contactId))
      const invited = contactInvitedToPortalEvent({
        email: plan.create.email,
        name: person.name,
        companyIds: clients.map(client => client.id),
      })
      await logActivity({
        ...base,
        targetType: 'CONTACT',
        targetId: person.contactId,
        targetCompanyId: clients[0]?.id ?? null,
        verb: invited.verb,
        summary: invited.summary,
        metadata: invited.metadata,
      })
    }
    return
  }

  if (plan.restore) {
    const event = userRestoredEvent({
      fullName: person.name,
      email: plan.current?.email,
      role: plan.roleChange?.role ?? plan.current?.role,
    })
    await logActivity({
      ...base,
      verb: event.verb,
      summary: event.summary,
      metadata: event.metadata,
    })
  }

  const changedFields: string[] = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  if (plan.create) changedFields.push('sign-in linked')
  if (plan.emailChange) {
    changedFields.push('email')
    before.email = plan.emailChange.from
    after.email = plan.emailChange.to
  }
  if (plan.roleChange) {
    const { role, effectiveFrom } = plan.roleChange
    const later = effectiveFrom > currentMonthStartUtc()
    changedFields.push(
      later
        ? `role to ${ROLE_LABELS[role]} from ${monthLabel(effectiveFrom)}`
        : `role to ${ROLE_LABELS[role]}`
    )
    before.role = plan.current?.role ?? null
    after.role = role
    after.roleEffectiveFrom = effectiveFrom
  }
  if (plan.enable !== null && !plan.create) {
    changedFields.push(plan.enable ? 'sign-in turned on' : 'sign-in turned off')
    before.canSignIn = !plan.enable
    after.canSignIn = plan.enable
  }
  if (!changedFields.length) return
  const event = userUpdatedEvent({
    fullName: person.name,
    changedFields,
    details: { before, after },
  })
  await logActivity({
    ...base,
    verb: event.verb,
    summary: event.summary,
    metadata: event.metadata,
  })
}
