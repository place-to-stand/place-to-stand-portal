/**
 * One-off backfill: create portal invoices for QuickBooks-era hour blocks.
 *
 * Hour blocks recorded before portal invoicing existed reference their
 * QuickBooks invoice by number only (`QB-*`) and have no `invoice_id`, so the
 * client portal — which reads the `invoices` table — never shows those paid
 * invoices. This script reconstructs each one:
 *
 *   - One PAID invoice per QB block, keeping the `QB-*` number verbatim so the
 *     QuickBooks origin stays visible everywhere the number renders.
 *   - Amounts are inferred from the block: hours_purchased × $200/hr (the rate
 *     every invoice in both systems has ever used). Tax rate is copied from the
 *     client's most recent portal invoice (0 when they have none), so clients
 *     whose portal invoices carry sales tax get the same rate here.
 *   - issued/due/paid dates all use the block's created_at — the closest proxy
 *     we have, since the original QB company file is no longer connected.
 *   - One "Development Hours" line item (creates_hour_block = true, linked to
 *     the catalog item when present), then the block's invoice_id and
 *     invoice_line_item_id are pointed at the new rows. Hours and
 *     billing_month are never touched, so prepaid burndown and monthly close
 *     are unaffected.
 *
 * Safe to run multiple times (idempotent):
 *   - Only blocks with `invoice_number LIKE 'QB-%' AND invoice_id IS NULL` are
 *     considered; linked blocks are skipped on re-run.
 *   - If an invoice with the block's number already exists (partial prior
 *     run), the block is linked to it instead of inserting a duplicate.
 *   - Everything runs in a single transaction — all or nothing.
 *
 * Dry-run by default: prints the full preview and writes nothing.
 *
 * Run (from apps/internal, with DATABASE_URL for the target environment):
 *   npx tsx scripts/backfill-qb-invoices.ts             # preview only
 *   npx tsx scripts/backfill-qb-invoices.ts --execute   # write
 *
 * This script is NOT executed automatically.
 */

import { config } from 'dotenv'
import { and, desc, eq, ilike, isNull, ne } from 'drizzle-orm'

import { createDb } from '@pts/db/client'
import {
  clients,
  hourBlocks,
  invoiceLineItems,
  invoices,
  productCatalogItems,
} from '@pts/db/schema'

// Mirror drizzle.config.ts env loading so the script can run standalone.
config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const HOURLY_RATE = 200
const LINE_ITEM_DESCRIPTION = 'Development Hours'

const round2 = (value: number) => Math.round(value * 100) / 100

async function main() {
  const execute = process.argv.includes('--execute')
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const db = createDb(databaseUrl)

  // QB-era blocks that never got a portal invoice.
  const blocks = await db
    .select({
      id: hourBlocks.id,
      invoiceNumber: hourBlocks.invoiceNumber,
      hoursPurchased: hourBlocks.hoursPurchased,
      createdAt: hourBlocks.createdAt,
      createdBy: hourBlocks.createdBy,
      clientId: hourBlocks.clientId,
      clientName: clients.name,
    })
    .from(hourBlocks)
    .innerJoin(clients, eq(clients.id, hourBlocks.clientId))
    .where(
      and(
        ilike(hourBlocks.invoiceNumber, 'QB-%'),
        isNull(hourBlocks.invoiceId),
        isNull(hourBlocks.deletedAt)
      )
    )
    .orderBy(hourBlocks.invoiceNumber)

  if (blocks.length === 0) {
    console.log('No unlinked QB-* hour blocks found. Nothing to do.')
    return
  }

  const [catalogItem] = await db
    .select({ id: productCatalogItems.id })
    .from(productCatalogItems)
    .where(
      and(
        eq(productCatalogItems.name, LINE_ITEM_DESCRIPTION),
        isNull(productCatalogItems.deletedAt)
      )
    )
    .limit(1)

  if (!catalogItem) {
    console.warn(
      `No active "${LINE_ITEM_DESCRIPTION}" catalog item found; line items will not be catalog-linked.`
    )
  }

  // Tax rate per client, copied from their most recent portal invoice so a
  // client whose invoices carry sales tax gets the same rate backfilled.
  const taxRateByClient = new Map<string, number>()

  for (const clientId of new Set(blocks.map(block => block.clientId))) {
    const [latest] = await db
      .select({ taxRate: invoices.taxRate })
      .from(invoices)
      .where(
        and(
          eq(invoices.clientId, clientId),
          isNull(invoices.deletedAt),
          ne(invoices.status, 'DRAFT')
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(1)

    taxRateByClient.set(clientId, Number(latest?.taxRate ?? 0))
  }

  console.log(
    `${execute ? 'Backfilling' : 'DRY RUN — would backfill'} ${blocks.length} invoice(s):\n`
  )

  const plans = blocks.map(block => {
    const hours = Number(block.hoursPurchased)
    const taxRate = taxRateByClient.get(block.clientId) ?? 0
    const subtotal = round2(hours * HOURLY_RATE)
    const taxAmount = round2(subtotal * taxRate)
    const total = round2(subtotal + taxAmount)
    const date = block.createdAt.slice(0, 10)

    console.log(
      `  ${block.invoiceNumber}  ${block.clientName.padEnd(24)} ${String(hours).padStart(5)}h  ` +
        `$${subtotal.toFixed(2).padStart(8)} + tax $${taxAmount.toFixed(2).padStart(6)} = $${total.toFixed(2).padStart(8)}  (${date})`
    )

    return { block, hours, taxRate, subtotal, taxAmount, total }
  })

  if (!execute) {
    console.log('\nDry run complete — nothing written. Re-run with --execute.')
    return
  }

  await db.transaction(async tx => {
    for (const { block, hours, taxRate, subtotal, taxAmount, total } of plans) {
      const invoiceNumber = block.invoiceNumber!

      // Partial-run recovery: reuse an existing invoice with this number
      // rather than violating the unique constraint.
      let [invoice] = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.invoiceNumber, invoiceNumber))
        .limit(1)

      if (!invoice) {
        ;[invoice] = await tx
          .insert(invoices)
          .values({
            invoiceNumber,
            status: 'PAID',
            clientId: block.clientId,
            createdBy: block.createdBy,
            billingType: 'prepaid',
            issuedDate: block.createdAt.slice(0, 10),
            // due_date stays null: portal invoices are due on receipt, and no
            // existing invoice populates it.
            paidAt: block.createdAt,
            taxRate: taxRate.toFixed(4),
            subtotal: subtotal.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            total: total.toFixed(2),
            notes: 'Backfilled from QuickBooks invoice records.',
            // Backdate record timestamps to the block's creation: the invoices
            // list's "Issued" column sorts by created_at, so a backfill-time
            // created_at would pin every QB invoice to the top of the list.
            createdAt: block.createdAt,
            updatedAt: block.createdAt,
          })
          .returning({ id: invoices.id })
      }

      if (!invoice) {
        throw new Error(`Failed to create invoice ${invoiceNumber}`)
      }

      let [lineItem] = await tx
        .select({ id: invoiceLineItems.id })
        .from(invoiceLineItems)
        .where(
          and(
            eq(invoiceLineItems.invoiceId, invoice.id),
            isNull(invoiceLineItems.deletedAt)
          )
        )
        .limit(1)

      if (!lineItem) {
        ;[lineItem] = await tx
          .insert(invoiceLineItems)
          .values({
            invoiceId: invoice.id,
            productCatalogItemId: catalogItem?.id ?? null,
            description: LINE_ITEM_DESCRIPTION,
            quantity: hours.toFixed(2),
            unitPrice: HOURLY_RATE.toFixed(2),
            amount: subtotal.toFixed(2),
            createsHourBlock: true,
            sortOrder: 0,
          })
          .returning({ id: invoiceLineItems.id })
      }

      if (!lineItem) {
        throw new Error(`Failed to create line item for ${invoiceNumber}`)
      }

      // Deliberately does NOT bump updated_at: every affected billing month is
      // closed, and fetchLateRecords flags hour blocks with
      // updated_at > closed_at as late changes. Linking columns feed no close
      // value, so leaving the timestamp keeps the backfill out of that list.
      await tx
        .update(hourBlocks)
        .set({
          invoiceId: invoice.id,
          invoiceLineItemId: lineItem.id,
        })
        .where(eq(hourBlocks.id, block.id))

      console.log(`  Linked ${invoiceNumber} → invoice ${invoice.id}`)
    }
  })

  console.log(`\nDone. Backfilled ${plans.length} invoice(s).`)
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error('backfill-qb-invoices failed:', error)
    process.exit(1)
  })
