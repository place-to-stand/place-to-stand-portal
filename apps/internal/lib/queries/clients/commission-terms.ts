import 'server-only'

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clientCommissionTermClosers,
  clientCommissionTerms,
  clients,
  contacts,
  users,
} from '@/lib/db/schema'
import {
  closerSplitsEqual,
  type ClientCloser,
  type CloserShare,
} from '@/lib/settings/clients/closers'

import { currentMonthStartUtc } from './billing-terms'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbOrTransaction = typeof db | DbTransaction

/**
 * One commission split: who closed the deal (zero or more closers sharing
 * the closer rate) and who originated it. No closers means the closer share
 * is not paid out and is reported under House (estimated); origination user +
 * contact are mutually exclusive (CHECK constraint).
 */
export type CommissionAssignment = {
  closers: CloserShare[]
  originationUserId: string | null
  originationContactId: string | null
}

export function commissionAssignmentsEqual(
  a: CommissionAssignment,
  b: CommissionAssignment
): boolean {
  return (
    closerSplitsEqual(a.closers, b.closers) &&
    (a.originationUserId ?? null) === (b.originationUserId ?? null) &&
    (a.originationContactId ?? null) === (b.originationContactId ?? null)
  )
}

async function insertTermClosers(
  tx: DbOrTransaction,
  termId: string,
  closers: CloserShare[]
): Promise<void> {
  if (closers.length === 0) return
  await tx.insert(clientCommissionTermClosers).values(
    closers.map(closer => ({
      termId,
      closerUserId: closer.kind === 'user' ? closer.id : null,
      closerContactId: closer.kind === 'contact' ? closer.id : null,
      sharePercent: closer.sharePercent.toFixed(2),
    }))
  )
}

/**
 * Inserts a client's first commission term, effective the first of the
 * creation month. Must run in the same transaction as the client insert so
 * the client's first month resolves its closers/origination.
 */
export async function insertInitialCommissionTerm(
  tx: DbOrTransaction,
  params: CommissionAssignment & {
    clientId: string
    createdBy: string | null
  }
): Promise<void> {
  const [term] = await tx
    .insert(clientCommissionTerms)
    .values({
      clientId: params.clientId,
      effectiveFrom: currentMonthStartUtc(),
      originationUserId: params.originationUserId,
      originationContactId: params.originationContactId,
      createdBy: params.createdBy,
    })
    .returning({ id: clientCommissionTerms.id })

  await insertTermClosers(tx, term.id, params.closers)
}

/**
 * Inserts a term at a month boundary, or overwrites the split of the existing
 * active term at that boundary (re-editing a scheduled boundary upserts
 * rather than erroring). The term's closer rows are replaced as a set: the
 * previous rows are soft-deleted, never edited in place. Mirrors
 * `upsertBillingTerm`.
 */
export async function upsertCommissionTerm(
  tx: DbOrTransaction,
  params: CommissionAssignment & {
    clientId: string
    effectiveFrom: string
    createdBy: string | null
  }
): Promise<void> {
  const now = new Date().toISOString()
  const [term] = await tx
    .insert(clientCommissionTerms)
    .values({
      clientId: params.clientId,
      effectiveFrom: params.effectiveFrom,
      originationUserId: params.originationUserId,
      originationContactId: params.originationContactId,
      createdBy: params.createdBy,
    })
    .onConflictDoUpdate({
      target: [clientCommissionTerms.clientId, clientCommissionTerms.effectiveFrom],
      targetWhere: sql`deleted_at IS NULL`,
      set: {
        originationUserId: params.originationUserId,
        originationContactId: params.originationContactId,
        createdBy: params.createdBy,
        updatedAt: now,
      },
    })
    .returning({ id: clientCommissionTerms.id })

  await tx
    .update(clientCommissionTermClosers)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(clientCommissionTermClosers.termId, term.id),
        isNull(clientCommissionTermClosers.deletedAt)
      )
    )

  await insertTermClosers(tx, term.id, params.closers)
}

/**
 * Each client's closers on its newest active term (scheduled or in effect),
 * resolved for display and ordered by share, largest first. Clients with no
 * closers are absent from the map. Archived closers still resolve — a split
 * keeps its history even after someone leaves.
 */
export async function fetchLatestClosersByClient(
  clientIds: string[]
): Promise<Map<string, ClientCloser[]>> {
  const result = new Map<string, ClientCloser[]>()
  if (clientIds.length === 0) return result

  const latestTerms = db
    .selectDistinctOn([clientCommissionTerms.clientId], {
      termId: clientCommissionTerms.id,
      clientId: clientCommissionTerms.clientId,
    })
    .from(clientCommissionTerms)
    .where(
      and(
        inArray(clientCommissionTerms.clientId, clientIds),
        isNull(clientCommissionTerms.deletedAt)
      )
    )
    .orderBy(
      clientCommissionTerms.clientId,
      desc(clientCommissionTerms.effectiveFrom)
    )
    .as('latest_terms')

  const rows = await db
    .select({
      clientId: latestTerms.clientId,
      closerUserId: clientCommissionTermClosers.closerUserId,
      closerContactId: clientCommissionTermClosers.closerContactId,
      sharePercent: clientCommissionTermClosers.sharePercent,
      userName: users.fullName,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
      userUpdatedAt: users.updatedAt,
      contactName: contacts.name,
      contactEmail: contacts.email,
    })
    .from(latestTerms)
    .innerJoin(
      clientCommissionTermClosers,
      and(
        eq(clientCommissionTermClosers.termId, latestTerms.termId),
        isNull(clientCommissionTermClosers.deletedAt)
      )
    )
    .leftJoin(users, eq(users.id, clientCommissionTermClosers.closerUserId))
    .leftJoin(
      contacts,
      eq(contacts.id, clientCommissionTermClosers.closerContactId)
    )
    .orderBy(desc(clientCommissionTermClosers.sharePercent))

  for (const row of rows) {
    const closer: ClientCloser = row.closerUserId
      ? {
          kind: 'user',
          id: row.closerUserId,
          sharePercent: Number(row.sharePercent),
          name: row.userName?.trim() || row.userEmail || 'Unknown user',
          email: row.userEmail,
          avatarUrl: row.userAvatarUrl,
          avatarUpdatedAt: row.userUpdatedAt,
        }
      : {
          kind: 'contact',
          id: row.closerContactId as string,
          sharePercent: Number(row.sharePercent),
          name: row.contactName?.trim() || row.contactEmail || 'Unknown contact',
          email: row.contactEmail,
          avatarUrl: null,
          avatarUpdatedAt: null,
        }
    const list = result.get(row.clientId) ?? []
    list.push(closer)
    result.set(row.clientId, list)
  }

  return result
}

/** Resolves bare shares to display closers (names for the activity feed). */
export async function resolveClosers(
  shares: CloserShare[]
): Promise<ClientCloser[]> {
  const userIds = shares.filter(s => s.kind === 'user').map(s => s.id)
  const contactIds = shares.filter(s => s.kind === 'contact').map(s => s.id)

  const [userRows, contactRows] = await Promise.all([
    userIds.length
      ? db
          .select({
            id: users.id,
            name: users.fullName,
            email: users.email,
            avatarUrl: users.avatarUrl,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([]),
    contactIds.length
      ? db
          .select({ id: contacts.id, name: contacts.name, email: contacts.email })
          .from(contacts)
          .where(inArray(contacts.id, contactIds))
      : Promise.resolve([]),
  ])
  const usersById = new Map(userRows.map(row => [row.id, row]))
  const contactsById = new Map(contactRows.map(row => [row.id, row]))

  return shares.map(share => {
    if (share.kind === 'user') {
      const user = usersById.get(share.id)
      return {
        ...share,
        name: user?.name?.trim() || user?.email || 'Unknown user',
        email: user?.email ?? null,
        avatarUrl: user?.avatarUrl ?? null,
        avatarUpdatedAt: user?.updatedAt ?? null,
      }
    }
    const contact = contactsById.get(share.id)
    return {
      ...share,
      name: contact?.name?.trim() || contact?.email || 'Unknown contact',
      email: contact?.email ?? null,
      avatarUrl: null,
      avatarUpdatedAt: null,
    }
  })
}

type CommissionColumn = 'id' | 'originationUserId' | 'originationContactId'

/**
 * SQL fragment resolving one commission column as of a report period — the
 * newest `effective_from` <= period start wins, exactly like
 * `billingTypeAsOfSql`. Correlated against the outer `clients` table, so it
 * is only valid inside a query that joins `clients`. NULL when the resolved
 * term has no assignment (or no term exists at or before the period).
 */
function commissionColumnAsOfSql(column: CommissionColumn, periodStart: string) {
  return sql<string | null>`(
    SELECT ${clientCommissionTerms[column]}
    FROM ${clientCommissionTerms}
    WHERE ${clientCommissionTerms.clientId} = ${clients.id}
      AND ${clientCommissionTerms.effectiveFrom} <= ${periodStart}
      AND ${clientCommissionTerms.deletedAt} IS NULL
    ORDER BY ${clientCommissionTerms.effectiveFrom} DESC
    LIMIT 1
  )`
}

/** The id of the term in effect for the period — join its closer rows on it. */
export function commissionTermIdAsOfSql(periodStart: string) {
  return commissionColumnAsOfSql('id', periodStart)
}

export function originationUserIdAsOfSql(periodStart: string) {
  return commissionColumnAsOfSql('originationUserId', periodStart)
}

export function originationContactIdAsOfSql(periodStart: string) {
  return commissionColumnAsOfSql('originationContactId', periodStart)
}
