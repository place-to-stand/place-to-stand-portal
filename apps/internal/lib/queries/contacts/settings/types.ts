import type { CursorDirection, PageInfo } from '@/lib/pagination/cursor'
import type { ParsedSort } from '@/lib/pagination/sort'
import type { ContactSortField } from '@/lib/settings/contacts/filters'

import type { ContactProfile, SelectContact } from '../selectors'

export type LinkedClient = {
  id: string
  name: string
  slug: string
}

type ContactListMetrics = {
  totalClients: number
  clients: LinkedClient[]
}

/** A company the contact belongs to (main company first). */
export type ContactCompanyItem = {
  id: string
  name: string
  /** The company has a live client. */
  isClient: boolean
}

export type ContactsSettingsListItem = SelectContact &
  ContactProfile & {
    companies: ContactCompanyItem[]
    metrics: ContactListMetrics
  }

export type ContactsSettingsResult = {
  items: ContactsSettingsListItem[]
  /** Rows matching the active filters/search (drives `Showing N of M`). */
  totalCount: number
  /** Rows on the tab regardless of filters/search (the `M`). */
  unfilteredTotalCount: number
  pageInfo: PageInfo
}

export type ListContactsForSettingsInput = {
  status?: 'active' | 'archived'
  search?: string | null
  /** Only contacts with a live link to this client (validated UUID). */
  clientId?: string | null
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
  offset?: number | null
  sort?: ParsedSort<ContactSortField>
}
