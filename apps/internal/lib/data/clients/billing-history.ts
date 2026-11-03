import { personNameSql } from '@pts/db/names'
import 'server-only'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { assertCan } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import {
  billingTerms,
  clientBillingPeriods,
  commissionTermClosers,
  commissionTerms,
  contacts,
  users,
} from '@/lib/db/schema'

export type BillingHistoryParty = {
  kind: 'user' | 'contact'
  id: string
  name: string | null
}

export type CompanyBillingHistory = {
  /** Stretches of billing, oldest first; `endsOn` null = still billed. */
  periods: { startsOn: string; endsOn: string | null }[]
  /** Billing type by the month it takes effect, oldest first. */
  billingTerms: { effectiveFrom: string; billingType: string }[]
  /** Commission terms by the month they take effect, oldest first. */
  commissionTerms: {
    effectiveFrom: string
    originator: BillingHistoryParty | null
    closers: (BillingHistoryParty & { sharePercent: number })[]
  }[]
}

/**
 * A company's billing record over time: when it was billed, its billing type
 * by month and its commission terms. Read-only; the company sheet writes it.
 */
export async function fetchCompanyBillingHistory(
  user: AppUser,
  companyId: string
): Promise<CompanyBillingHistory> {
  assertCan(user, 'clients.manage')

  const [periods, types, terms] = await Promise.all([
    db
      .select({
        startsOn: clientBillingPeriods.startsOn,
        endsOn: clientBillingPeriods.endsOn,
      })
      .from(clientBillingPeriods)
      .where(
        and(
          eq(clientBillingPeriods.companyId, companyId),
          isNull(clientBillingPeriods.deletedAt)
        )
      )
      .orderBy(asc(clientBillingPeriods.startsOn)),
    db
      .select({
        effectiveFrom: billingTerms.effectiveFrom,
        billingType: billingTerms.billingType,
      })
      .from(billingTerms)
      .where(
        and(
          eq(billingTerms.companyId, companyId),
          isNull(billingTerms.deletedAt)
        )
      )
      .orderBy(asc(billingTerms.effectiveFrom)),
    db
      .select({
        id: commissionTerms.id,
        effectiveFrom: commissionTerms.effectiveFrom,
        originationUserId: commissionTerms.originationUserId,
        originationContactId: commissionTerms.originationContactId,
      })
      .from(commissionTerms)
      .where(
        and(
          eq(commissionTerms.companyId, companyId),
          isNull(commissionTerms.deletedAt)
        )
      )
      .orderBy(asc(commissionTerms.effectiveFrom)),
  ])

  const closers = terms.length
    ? await db
        .select({
          termId: commissionTermClosers.termId,
          userId: commissionTermClosers.closerUserId,
          contactId: commissionTermClosers.closerContactId,
          sharePercent: commissionTermClosers.sharePercent,
        })
        .from(commissionTermClosers)
        .where(
          and(
            inArray(
              commissionTermClosers.termId,
              terms.map(term => term.id)
            ),
            isNull(commissionTermClosers.deletedAt)
          )
        )
    : []

  const userIds = new Set<string>()
  const contactIds = new Set<string>()
  for (const term of terms) {
    if (term.originationUserId) userIds.add(term.originationUserId)
    if (term.originationContactId) contactIds.add(term.originationContactId)
  }
  for (const closer of closers) {
    if (closer.userId) userIds.add(closer.userId)
    if (closer.contactId) contactIds.add(closer.contactId)
  }

  const [userRows, contactRows] = await Promise.all([
    userIds.size
      ? db
          .select({ id: users.id, name: personNameSql, email: users.email })
          .from(users)
          .where(inArray(users.id, [...userIds]))
      : [],
    contactIds.size
      ? db
          .select({
            id: contacts.id,
            name: contacts.name,
            email: contacts.email,
          })
          .from(contacts)
          .where(inArray(contacts.id, [...contactIds]))
      : [],
  ])
  const names = new Map<string, string | null>()
  for (const row of [...userRows, ...contactRows]) {
    names.set(row.id, row.name?.trim() || row.email || null)
  }

  const party = (
    userId: string | null,
    contactId: string | null
  ): BillingHistoryParty | null =>
    userId
      ? { kind: 'user', id: userId, name: names.get(userId) ?? null }
      : contactId
        ? { kind: 'contact', id: contactId, name: names.get(contactId) ?? null }
        : null

  return {
    periods,
    billingTerms: types,
    commissionTerms: terms.map(term => ({
      effectiveFrom: term.effectiveFrom,
      originator: party(term.originationUserId, term.originationContactId),
      closers: closers
        .filter(closer => closer.termId === term.id)
        .map(closer => ({
          ...(party(closer.userId, closer.contactId) as BillingHistoryParty),
          sharePercent: Number(closer.sharePercent),
        }))
        .sort((a, b) => b.sharePercent - a.sharePercent),
    })),
  }
}
