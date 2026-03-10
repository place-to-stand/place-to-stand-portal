import type { ClientRow, ProductCatalogItemRow } from './invoice-form'

export type ClientOption = {
  value: string
  label: string
  keywords: string[]
  billingType: string
}

export type ProductCatalogOption = {
  value: string
  label: string
  keywords: string[]
  unitPrice: string
  unitLabel: string
  createsHourBlockDefault: boolean
}

export const buildClientOptions = (clients: ClientRow[]): ClientOption[] =>
  clients.map(client => ({
    value: client.id,
    label: client.deleted_at
      ? `${client.name} (Archived)`
      : client.name,
    keywords: client.deleted_at
      ? [client.name, 'archived']
      : [client.name],
    billingType: client.billing_type,
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
  }))
