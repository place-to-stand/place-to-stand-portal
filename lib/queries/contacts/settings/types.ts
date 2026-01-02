import type { CursorDirection, PageInfo } from '@/lib/pagination/cursor'

import type { SelectContact } from '../selectors'

export type ContactListMetrics = {
  totalClients: number
}

export type ContactsSettingsListItem = SelectContact & {
  metrics: ContactListMetrics
}

export type ContactsSettingsResult = {
  items: ContactsSettingsListItem[]
  totalCount: number
  pageInfo: PageInfo
}

export type ListContactsForSettingsInput = {
  status?: 'active' | 'archived'
  search?: string | null
  cursor?: string | null
  direction?: CursorDirection | null
  limit?: number | null
}
