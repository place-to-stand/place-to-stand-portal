import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db, type DbTx } from '@/lib/db'
import {
  commissionTermClosers,
  commissionTerms,
  contacts,
  users,
} from '@/lib/db/schema'
import {
  closerSplitsEqual,
  type ClientCloser,
  type CloserShare,
} from '@/lib/companies/billing/closers'


type DbOrTransaction = typeof db | DbTx

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
  await tx.insert(commissionTermClosers).values(
    closers.map(closer => ({
      termId,
      closerUserId: closer.kind === 'user' ? closer.id : null,
      closerContactId: closer.kind === 'contact' ? closer.id : null,
      sharePercent: closer.sharePercent.toFixed(2),
    }))
  )
}

/**
 * Inserts a client's first commission term, effective its first billed month
 * (the billing period's `starts_on`). Must run in the same transaction as the
 * billing start so the client's first month resolves its closers/origination.
 */
export async function insertInitialCommissionTerm(
  tx: DbOrTransaction,
  params: CommissionAssignment & {
    companyId: string
    /** The first billed month ('yyyy-MM-01'). */
    effectiveFrom: string
    createdBy: string | null
  }
): Promise<void> {
  const [term] = await tx
    .insert(commissionTerms)
    .values({
      companyId: params.companyId,
      effectiveFrom: params.effectiveFrom,
      originationUserId: params.originationUserId,
      originationContactId: params.originationContactId,
      createdBy: params.createdBy,
    })
    .returning({ id: commissionTerms.id })

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
    companyId: string
    effectiveFrom: string
    createdBy: string | null
  }
): Promise<void> {
  const now = new Date().toISOString()
  const [term] = await tx
    .insert(commissionTerms)
    .values({
      companyId: params.companyId,
      effectiveFrom: params.effectiveFrom,
      originationUserId: params.originationUserId,
      originationContactId: params.originationContactId,
      createdBy: params.createdBy,
    })
    .onConflictDoUpdate({
      target: [commissionTerms.companyId, commissionTerms.effectiveFrom],
      targetWhere: sql`deleted_at IS NULL`,
      set: {
        originationUserId: params.originationUserId,
        originationContactId: params.originationContactId,
        createdBy: params.createdBy,
        updatedAt: now,
      },
    })
    .returning({ id: commissionTerms.id })

  await tx
    .update(commissionTermClosers)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(commissionTermClosers.termId, term.id),
        isNull(commissionTermClosers.deletedAt)
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
  companyIds: string[]
): Promise<Map<string, ClientCloser[]>> {
  const result = new Map<string, ClientCloser[]>()
  if (companyIds.length === 0) return result

  const latestTerms = db
    .selectDistinctOn([commissionTerms.companyId], {
      termId: commissionTerms.id,
      companyId: commissionTerms.companyId,
    })
    .from(commissionTerms)
    .where(
      and(
        inArray(commissionTerms.companyId, companyIds),
        isNull(commissionTerms.deletedAt)
      )
    )
    .orderBy(commissionTerms.companyId, desc(commissionTerms.effectiveFrom))
    .as('latest_terms')

  const rows = await db
    .select({
      companyId: latestTerms.companyId,
      closerUserId: commissionTermClosers.closerUserId,
      closerContactId: commissionTermClosers.closerContactId,
      sharePercent: commissionTermClosers.sharePercent,
      userName: personNameSql,
      userEmail: users.email,
      userAvatarUrl: personAvatarSql,
      userUpdatedAt: users.updatedAt,
      contactName: contacts.name,
      contactEmail: contacts.email,
    })
    .from(latestTerms)
    .innerJoin(
      commissionTermClosers,
      and(
        eq(commissionTermClosers.termId, latestTerms.termId),
        isNull(commissionTermClosers.deletedAt)
      )
    )
    .leftJoin(users, eq(users.id, commissionTermClosers.closerUserId))
    .leftJoin(contacts, eq(contacts.id, commissionTermClosers.closerContactId))
    .orderBy(desc(commissionTermClosers.sharePercent))

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
          name: row.contactName?.trim() || row.contactEmail || 'Unknown person',
          email: row.contactEmail,
          avatarUrl: null,
          avatarUpdatedAt: null,
        }
    const list = result.get(row.companyId) ?? []
    list.push(closer)
    result.set(row.companyId, list)
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
            name: personNameSql,
            email: users.email,
            avatarUrl: personAvatarSql,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([]),
    contactIds.length
      ? db
          .select({
            id: contacts.id,
            name: contacts.name,
            email: contacts.email,
          })
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
      name: contact?.name?.trim() || contact?.email || 'Unknown person',
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
 * `billingTypeAsOfSql`. Correlated against the outer `companies` table
 * (written table-qualified), so it is only valid inside a query that reads
 * `companies`. NULL when the resolved
 * term has no assignment (or no term exists at or before the period).
 */
function commissionColumnAsOfSql(
  column: CommissionColumn,
  periodStart: string
) {
  return sql<string | null>`(
    SELECT ${commissionTerms[column]}
    FROM ${commissionTerms}
    WHERE ${commissionTerms.companyId} = ${sql.raw('"companies"."id"')}
      AND ${commissionTerms.effectiveFrom} <= ${periodStart}
      AND ${commissionTerms.deletedAt} IS NULL
    ORDER BY ${commissionTerms.effectiveFrom} DESC
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

/**
 * The client's current origination: the newest term's (latest effective
 * date, even a future one, which is what the company sheet's billing last saved).
 * Correlated against the outer `companies` table. The terms table is the one
 * place commission is stored; reports resolve by period with the `AsOf`
 * helpers above.
 */
function latestCommissionColumnSql(column: CommissionColumn) {
  // The outer column is written out table-qualified: drizzle drops the table
  // name from an interpolated column inside a selected fragment, which would
  // bind it to the terms table's own id.
  return sql<string | null>`(
    SELECT ${commissionTerms[column]}
    FROM ${commissionTerms}
    WHERE ${commissionTerms.companyId} = ${sql.raw('"companies"."id"')}
      AND ${commissionTerms.deletedAt} IS NULL
    ORDER BY ${commissionTerms.effectiveFrom} DESC
    LIMIT 1
  )`
}

export function currentOriginationUserIdSql() {
  return latestCommissionColumnSql('originationUserId')
}

export function currentOriginationContactIdSql() {
  return latestCommissionColumnSql('originationContactId')
}
