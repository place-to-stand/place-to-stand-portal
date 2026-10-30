import { clientBillingType } from '@/lib/db/schema'
import type { ParsedSort } from '@/lib/pagination/sort'

export const CLIENT_BILLING_VALUES = clientBillingType.enumValues

export type ClientBillingFilter = (typeof CLIENT_BILLING_VALUES)[number]


/** Sort fields the clients list query (CLI/MCP) resolves. */
export type ClientSortField = 'name' | 'created'

export const DEFAULT_CLIENTS_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<ClientSortField>
