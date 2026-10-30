import { clients } from '@/lib/db/schema'
import { currentBillingTypeSql } from '@/lib/queries/clients/billing-terms'
import {
  currentOriginationContactIdSql,
  currentOriginationUserIdSql,
} from '@/lib/queries/clients/commission-terms'

// Commission (origination, closers) lives only on the commission terms; the
// origination fields here are the newest term's. `website` is the company's
// now (the client's copy is legacy; see `clientWebsiteSql`).
export type SelectClient = Omit<typeof clients.$inferSelect, 'website'> & {
  /** The newest billing term's type (terms are the source). */
  billingType: 'prepaid' | 'net_30'
  /** The newest commission term's origination (terms are the source). */
  originationContactId: string | null
  originationUserId: string | null
}

export const clientFields = {
  id: clients.id,
  name: clients.name,
  slug: clients.slug,
  notes: clients.notes,
  billingType: currentBillingTypeSql(),
  state: clients.state,
  originationContactId: currentOriginationContactIdSql(),
  originationUserId: currentOriginationUserIdSql(),
  companyId: clients.companyId,
  label: clients.label,
  createdBy: clients.createdBy,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
  deletedAt: clients.deletedAt,
}

export const clientGroupByColumns = [
  clients.id,
  clients.name,
  clients.slug,
  clients.notes,
  clients.state,
  clients.companyId,
  clients.label,
  clients.createdBy,
  clients.createdAt,
  clients.updatedAt,
  clients.deletedAt,
] as const
export const ACTIVE_STATUS = 'ACTIVE'
