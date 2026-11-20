import { currentBillingTypeSql } from '@pts/db/terms'
import { clientEndedAtSql, clientSinceSql } from '@pts/db/client-state'
import { companies } from '@/lib/db/schema'
import {
  currentOriginationContactIdSql,
  currentOriginationUserIdSql,
} from '@/lib/queries/companies/billing/commission-terms'

export const clientFields = {
  id: companies.id,
  name: companies.name,
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
