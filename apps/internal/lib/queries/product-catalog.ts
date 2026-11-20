import 'server-only'

import { asc, and, isNull, eq } from 'drizzle-orm'

import { db, type DbTx } from '@/lib/db'

/** The default client, or the transaction Settings → Billing saves in. */
type Executor = typeof db | DbTx
import { productCatalogItems } from '@/lib/db/schema'

export type ProductCatalogItemRow = {
  id: string
  name: string
  description: string | null
  unit_price: string
  unit_label: string
  creates_hour_block_default: boolean
  is_active: boolean
  min_quantity: number | null
  sort_order: number
}

type ProductCatalogItemInput = {
  name: string
  description: string | null
  unitPrice: string
  unitLabel: string
  createsHourBlockDefault: boolean
  isActive: boolean
  minQuantity: number | null
  sortOrder: number
}

const productCatalogSelection = {
  id: productCatalogItems.id,
  name: productCatalogItems.name,
  description: productCatalogItems.description,
  unitPrice: productCatalogItems.unitPrice,
  unitLabel: productCatalogItems.unitLabel,
  createsHourBlockDefault: productCatalogItems.createsHourBlockDefault,
  isActive: productCatalogItems.isActive,
  minQuantity: productCatalogItems.minQuantity,
  sortOrder: productCatalogItems.sortOrder,
} as const

function mapRow(r: {
  id: string
  name: string
  description: string | null
  unitPrice: string
  unitLabel: string
  createsHourBlockDefault: boolean
  isActive: boolean
  minQuantity: number | null
  sortOrder: number
}): ProductCatalogItemRow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    unit_price: r.unitPrice,
    unit_label: r.unitLabel,
    creates_hour_block_default: r.createsHourBlockDefault,
    is_active: r.isActive,
    min_quantity: r.minQuantity,
    sort_order: r.sortOrder,
  }
}

/** Active items, for the invoice sheet. */
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

  return rows.map(mapRow)
}

/** Every item, inactive included, for Settings → Billing. */
export async function listAllProductCatalogItems(): Promise<
  ProductCatalogItemRow[]
> {
  const rows = await db
    .select(productCatalogSelection)
    .from(productCatalogItems)
    .where(isNull(productCatalogItems.deletedAt))
    .orderBy(asc(productCatalogItems.sortOrder))

  return rows.map(mapRow)
}

export async function getProductCatalogItemById(
  id: string,
  executor: Executor = db
): Promise<ProductCatalogItemRow | null> {
  const rows = await executor
    .select(productCatalogSelection)
    .from(productCatalogItems)
    .where(
      and(eq(productCatalogItems.id, id), isNull(productCatalogItems.deletedAt))
    )
    .limit(1)

  const row = rows[0]
  return row ? mapRow(row) : null
}

export async function createProductCatalogItem(
  input: ProductCatalogItemInput,
  executor: Executor = db
): Promise<ProductCatalogItemRow> {
  const now = new Date().toISOString()

  const [row] = await executor
    .insert(productCatalogItems)
    .values({
      name: input.name,
      description: input.description,
      unitPrice: input.unitPrice,
      unitLabel: input.unitLabel,
      createsHourBlockDefault: input.createsHourBlockDefault,
      isActive: input.isActive,
      minQuantity: input.minQuantity,
      sortOrder: input.sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning(productCatalogSelection)

  return mapRow(row)
}

export async function updateProductCatalogItem(
  id: string,
  input: Partial<ProductCatalogItemInput>,
  executor: Executor = db
): Promise<ProductCatalogItemRow | null> {
  const now = new Date().toISOString()

  const rows = await executor
    .update(productCatalogItems)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.unitPrice !== undefined && { unitPrice: input.unitPrice }),
      ...(input.unitLabel !== undefined && { unitLabel: input.unitLabel }),
      ...(input.createsHourBlockDefault !== undefined && {
        createsHourBlockDefault: input.createsHourBlockDefault,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.minQuantity !== undefined && {
        minQuantity: input.minQuantity,
      }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      updatedAt: now,
    })
    .where(
      and(eq(productCatalogItems.id, id), isNull(productCatalogItems.deletedAt))
    )
    .returning(productCatalogSelection)

  const row = rows[0]
  if (!row) return null

  return mapRow(row)
}
