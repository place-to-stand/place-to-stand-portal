import type { ClientCloser } from '@/lib/companies/billing/closers'
import type { ParsedSort } from '@/lib/pagination/sort'
import type {
  ClientBillingFilter,
  ClientSortField,
} from '@/lib/companies/billing/filters'

import type { SelectClient } from '../selectors'

type ClientListMetrics = {
  totalProjects: number
  activeProjects: number
}

export type ClientsSettingsListItem = SelectClient & {
  /** Closers on the newest commission term, largest share first. */
  closers: ClientCloser[]
  metrics: ClientListMetrics
}

export type ClientsSettingsMembersMap = Record<
  string,
  Array<{
    id: string
    email: string
    fullName: string | null
  }>
>

export type ClientsSettingsResult = {
  items: ClientsSettingsListItem[]
  membersByClient: ClientsSettingsMembersMap
  clientUsers: Array<{
    id: string
    email: string
    fullName: string | null
  }>
  /** Rows matching the active filters/search (drives `Showing N of M`). */
  totalCount: number
  /** Rows on the tab regardless of filters/search (the `M`). */
  unfilteredTotalCount: number
}

export type ListClientsForSettingsInput = {
  status?: 'active' | 'archived'
  billing?: ClientBillingFilter | null
  search?: string | null
  /** Rows to skip (offset paging: `(page - 1) * limit`). */
  offset?: number | null
  limit?: number | null
  sort?: ParsedSort<ClientSortField>
}

