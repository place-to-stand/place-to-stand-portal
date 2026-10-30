import { clientBillingType } from '@/lib/db/schema'
import type { ParsedSort } from '@/lib/pagination/sort'

export const CLIENT_BILLING_VALUES = clientBillingType.enumValues

export type ClientBillingFilter = (typeof CLIENT_BILLING_VALUES)[number]

export function isClientBilling(
  value: string | undefined
): value is ClientBillingFilter {
  return (
    typeof value === 'string' &&
    (CLIENT_BILLING_VALUES as readonly string[]).includes(value)
  )
}

/** Sort fields the clients list query (CLI/MCP) resolves. */
export type ClientSortField = 'name' | 'created'

export const DEFAULT_CLIENTS_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<ClientSortField>
