import 'server-only'

import { asc, and, isNull, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { productCatalogItems } from '@/lib/db/schema'

export type ProductCatalogItemRow = {
  id: string
  name: string
  description: string | null
  unit_price: string
  unit_label: string
  creates_hour_block_default: boolean
  sort_order: number
}

const productCatalogSelection = {
  id: productCatalogItems.id,
  name: productCatalogItems.name,
  description: productCatalogItems.description,
  unitPrice: productCatalogItems.unitPrice,
  unitLabel: productCatalogItems.unitLabel,
  createsHourBlockDefault: productCatalogItems.createsHourBlockDefault,
  sortOrder: productCatalogItems.sortOrder,
} as const

export async function listProductCatalogItems(): Promise<
  ProductCatalogItemRow[]
> {
  const rows = await db
    .select(productCatalogSelection)
    .from(productCatalogItems)
    .where(
      and(
        isNull(productCatalogItems.deletedAt),
        eq(productCatalogItems.isActive, true)
      )
    )
    .orderBy(asc(productCatalogItems.sortOrder))

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    unit_price: r.unitPrice,
    unit_label: r.unitLabel,
    creates_hour_block_default: r.createsHourBlockDefault,
    sort_order: r.sortOrder,
  }))
}
