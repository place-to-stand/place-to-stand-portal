import type { ClientRow, ProductCatalogItemRow } from './invoice-form'

export type ClientOption = {
  value: string
  label: string
  keywords: string[]
  billingType: string
  state: string | null
}

export type ProductCatalogOption = {
  value: string
  label: string
  keywords: string[]
  unitPrice: string
  unitLabel: string
  createsHourBlockDefault: boolean
  minQuantity: number | null
}

export const buildClientOptions = (clients: ClientRow[]): ClientOption[] =>
  clients
    .filter(client => !client.deleted_at)
    .map(client => ({
      value: client.id,
      label: client.name,
      keywords: [client.name],
      billingType: client.billing_type,
      state: client.state ?? null,
    }))

export const buildProductCatalogOptions = (
  items: ProductCatalogItemRow[]
): ProductCatalogOption[] =>
  items.map(item => ({
    value: item.id,
    label: item.name,
    keywords: [item.name, item.description ?? ''].filter(Boolean),
    unitPrice: item.unit_price,
    unitLabel: item.unit_label,
    createsHourBlockDefault: item.creates_hour_block_default,
    minQuantity: item.min_quantity ?? null,
  }))
