import 'server-only'

import { userUpdatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'

import { and, eq, isNull, ne, sql } from 'drizzle-orm'

import { db, type DbTx } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'
import { roleAsOfSql } from '@/lib/queries/users/role-terms'

import { syncStaffMembership } from './person'

type Role = 'ADMIN' | 'SALES' | 'CLIENT'

export type RoleChange = { from: Role; to: Role }

/**
 * Makes `users.role` the role in force this month (its newest
 * `user_role_terms` row on or before now) and keeps their staff-company
 * membership in step. `previousRole` is the role the sign-in had before
 * this save (null for a new sign-in). Returns the change, if any.
 */
export async function applyRoleInForce(
  tx: DbTx,
  input: { userId: string; contactId: string | null; previousRole: Role | null }
): Promise<RoleChange | null> {
  const [row] = await tx
    .select({
      role: users.role,
      inForce: roleAsOfSql(currentMonthStartUtc()),
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)
  if (!row) throw new Error('Their sign-in could not be found.')

  const inForce = (row.inForce as Role | null) ?? row.role
  if (inForce !== row.role) {
    await tx
      .update(users)
      .set({ role: inForce, updatedAt: new Date().toISOString() })
      .where(eq(users.id, input.userId))
  }
  if (input.contactId && input.previousRole !== inForce) {
    await syncStaffMembership(tx, input.contactId, input.previousRole, inForce)
  }
  return input.previousRole && input.previousRole !== inForce
    ? { from: input.previousRole, to: inForce }
    : null
}

/**
 * A role change dated next month leaves `users.role` as it is until then.
 * This brings every sign-in whose term has since come into force up to
 * date (daily cron, and on sign-in for the person themselves).
 */
export async function applyDueRoleTerms(
  onlyUserId?: string
): Promise<RoleChange[]> {
  const inForce = roleAsOfSql(currentMonthStartUtc())
  const due = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`${inForce} is not null`,
        ne(users.role, sql`${inForce}::user_role`),
        // An archived sign-in keeps its last role.
        isNull(users.deletedAt),
        onlyUserId ? eq(users.id, onlyUserId) : undefined
      )
    )

  const changes: RoleChange[] = []
  for (const { id } of due) {
    const change = await db.transaction(async tx => {
      const [locked] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, id))
        .for('update')
      if (!locked) return null
      const [person] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.userId, id), isNull(contacts.deletedAt)))
        .limit(1)
      return applyRoleInForce(tx, {
        userId: id,
        contactId: person?.id ?? null,
        previousRole: locked.role,
      })
    })
    if (change) {
      changes.push(change)
      // The audit trail shows when the scheduled role actually took effect.
      await logActivity({
        actorId: null,
        source: 'SYSTEM',
        targetType: 'USER',
        targetId: id,
        ...userUpdatedEvent({
          fullName: (await personNameForUser(id)) ?? 'a sign-in',
          changedFields: ['role'],
          details: {
            before: { role: change.from },
            after: { role: change.to },
            reason: 'scheduled role change took effect',
          },
        }),
      }).catch(error =>
        console.error('Failed to log a scheduled role change', error)
      )
    }
  }
  return changes
}

async function personNameForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: contacts.name })
    .from(contacts)
    .where(eq(contacts.userId, userId))
    .limit(1)
  return row?.name ?? null
}
