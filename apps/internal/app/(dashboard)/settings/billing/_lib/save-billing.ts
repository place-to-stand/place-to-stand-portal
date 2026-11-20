import 'server-only'

import { and, inArray, sql } from 'drizzle-orm'

import { businessSettings, users } from '@pts/db/schema'

import { businessSettingsUpdatedEvent } from '@/lib/activity/events'
import type { ActivityEvent } from '@/lib/activity/types'
import type { AppUser } from '@/lib/auth/session'
import {
  profitShareKey,
  type BillingSavePayload,
  type BillingSavePayloadInput,
} from '@/lib/billing/billing-settings-form'
import { db } from '@/lib/db'
import type { ProductCatalogItemRow } from '@/lib/queries/product-catalog'
import { eligiblePartner } from '@/lib/queries/reports/profit-share-partners'
import type { TaxRateRow } from '@/lib/queries/tax-rates'

/** The parts of saveBillingSettings (../actions.ts) that aren't the save itself. */

/** A row the save expected is gone (or archived). */
export class RowNotFoundError extends Error {}

/** Someone else saved this row after the page loaded it. */
export class RowChangedError extends Error {}

/** Postgres unique violation (drizzle puts the driver error on `cause`). */
export function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) =>
    typeof value === 'object' && value !== null
      ? (value as { code?: string }).code
      : undefined
  return (
    code(error) === '23505' ||
    code((error as { cause?: unknown } | null)?.cause) === '23505'
  )
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

type Diff = {
  changedFields: string[]
  details: { before: Record<string, unknown>; after: Record<string, unknown> }
}

/**
 * Compares two rows field by field. `fields` maps the row key to the
 * human-readable label used in `changedFields`; `details` keeps the raw
 * values under the camelCase form of the row key so the feed can format
 * them like every other domain's diff.
 */
const toCamel = (key: string) =>
  key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())

export function diffRows<T extends object>(
  before: T,
  after: T,
  fields: Record<string, string>
): Diff {
  const diff: Diff = { changedFields: [], details: { before: {}, after: {} } }

  for (const [key, label] of Object.entries(fields)) {
    const previous = (before as Record<string, unknown>)[key] ?? null
    const next = (after as Record<string, unknown>)[key] ?? null

    if (previous !== next) {
      diff.changedFields.push(label)
      diff.details.before[toCamel(key)] = previous
      diff.details.after[toCamel(key)] = next
    }
  }

  return diff
}

export const PRODUCT_FIELDS: Partial<
  Record<keyof ProductCatalogItemRow, string>
> = {
  name: 'name',
  description: 'description',
  unit_price: 'unit price',
  unit_label: 'unit label',
  creates_hour_block_default: 'hour block default',
  is_active: 'active',
  min_quantity: 'minimum quantity',
  sort_order: 'sort order',
}

export const TAX_RATE_FIELDS: Partial<Record<keyof TaxRateRow, string>> = {
  label: 'label',
  state: 'state',
  rate: 'rate',
  is_active: 'active',
}

/** The profit share fields a save can flag. */
export type ProfitShareFieldErrors = Partial<
  Record<
    | 'profitShareStartMonth'
    | 'profitShareMinimumBalance'
    | 'profitSharePartnerIds',
    string
  >
>

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Writes the profit share; returns its activity event when it changed. */
export async function saveProfitShare(
  tx: Tx,
  user: AppUser,
  values: BillingSavePayload
): Promise<ActivityEvent | null> {
  // Untouched on this page: leave it as it is now.
  if (profitShareKey(values) === profitShareKey(values.profitShareBase)) {
    return null
  }
  const [current] = await tx
    .select({
      startsOn: businessSettings.profitShareStartsOn,
      minimumBalance: businessSettings.profitShareMinimumBalance,
      partnerIds: businessSettings.profitSharePartnerIds,
    })
    .from(businessSettings)
    .limit(1)
  const before = {
    startsOn: current?.startsOn ?? null,
    minimumBalance: Number(current?.minimumBalance ?? 0),
    partnerIds: current?.partnerIds ?? [],
  }
  const asLoaded = {
    profitShareStartMonth: before.startsOn ? before.startsOn.slice(0, 7) : '',
    profitShareMinimumBalance: String(before.minimumBalance),
    profitSharePartnerIds: before.partnerIds,
  }
  if (profitShareKey(asLoaded) !== profitShareKey(values.profitShareBase)) {
    throw new RowChangedError('The profit share')
  }
  const after = {
    startsOn: values.profitShareStartMonth
      ? `${values.profitShareStartMonth}-01`
      : null,
    minimumBalance: Number(values.profitShareMinimumBalance || 0),
    partnerIds: values.profitSharePartnerIds,
  }

  const changedFields: string[] = []
  if (before.startsOn !== after.startsOn) {
    changedFields.push('profit share start month')
  }
  if (before.minimumBalance !== after.minimumBalance) {
    changedFields.push('profit share minimum balance')
  }
  if (before.partnerIds.join() !== after.partnerIds.join()) {
    changedFields.push('profit share partners')
  }
  if (changedFields.length === 0) return null

  const row = {
    profitShareStartsOn: after.startsOn,
    profitShareMinimumBalance: after.minimumBalance.toFixed(2),
    profitSharePartnerIds: after.partnerIds,
    updatedBy: user.id,
    updatedAt: sql`now()`,
  }
  // The row may not exist yet on a new install: create it unconfirmed, so
  // the Business setup banner still shows until someone saves that page.
  await tx
    .insert(businessSettings)
    .values({ id: true, ...row })
    .onConflictDoUpdate({ target: businessSettings.id, set: row })

  return businessSettingsUpdatedEvent({
    changedFields,
    details: { before: { profitShare: before }, after: { profitShare: after } },
  })
}

/** Every partner can split the profit share (`eligiblePartner`). */
export async function partnersAreStaff(ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)]
  if (unique.length !== ids.length) return false
  if (unique.length === 0) return true
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, unique), eligiblePartner))
  return rows.length === unique.length
}

/** A validation failure as one toast line plus the profit share's field errors. */
export function describeIssues(
  issues: { path: PropertyKey[]; message: string }[],
  input: BillingSavePayloadInput
): { error: string; fieldErrors?: ProfitShareFieldErrors } {
  const fieldErrors: ProfitShareFieldErrors = {}
  for (const issue of issues) {
    const [key, index] = issue.path
    if (key === 'products' && typeof index === 'number') {
      const name = input.products?.[index]?.name || 'A product'
      return { error: `${name}: ${issue.message}` }
    }
    if (key === 'taxRates' && typeof index === 'number') {
      const label = input.taxRates?.[index]?.label || 'A tax rate'
      return { error: `${label}: ${issue.message}` }
    }
    if (
      key === 'profitShareStartMonth' ||
      key === 'profitShareMinimumBalance' ||
      key === 'profitSharePartnerIds'
    ) {
      fieldErrors[key] ??= issue.message
    }
  }
  return { error: 'Check the highlighted fields.', fieldErrors }
}
