import { clientEndedAtSql, clientSinceSql } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import { companies } from '@/lib/db/schema'
import { currentBillingTypeSql } from '@/lib/queries/clients/billing-terms'
import {
  currentOriginationContactIdSql,
  currentOriginationUserIdSql,
} from '@/lib/queries/clients/commission-terms'

// A client is a company you bill. Commission (origination, closers) lives
// only on the commission terms; the origination fields are the newest term's.
export type SelectClient = {
  id: string
  /** The company's name. */
  name: string
  slug: string | null
  notes: string | null
  state: string | null
  /** The same as `id` (a client is its company). */
  companyId: string
  createdBy: string | null
  /** When it became a client. */
  createdAt: string | null
  updatedAt: string
  /** When billing stopped (or the company was archived). */
  deletedAt: string | null
  /** The newest billing term's type (terms are the source). */
  billingType: 'prepaid' | 'net_30'
  /** The newest commission term's origination (terms are the source). */
  originationContactId: string | null
  originationUserId: string | null
}

export const clientFields = {
  id: companies.id,
  name: clientNameSql,
  slug: companies.slug,
  notes: companies.notes,
  billingType: currentBillingTypeSql(),
  state: companies.state,
  originationContactId: currentOriginationContactIdSql(),
  originationUserId: currentOriginationUserIdSql(),
  companyId: companies.id,
  createdBy: companies.createdBy,
  createdAt: clientSinceSql,
  updatedAt: companies.updatedAt,
  deletedAt: clientEndedAtSql,
}

export const clientGroupByColumns = [
  companies.id,
  clientNameSql,
  companies.slug,
  companies.notes,
  companies.state,
  companies.id,
  companies.createdBy,
  clientSinceSql,
  companies.updatedAt,
  clientEndedAtSql,
] as const
export const ACTIVE_STATUS = 'ACTIVE'
