import { and, eq, inArray, isNull, sql, type AnyColumn } from 'drizzle-orm'

import type { DbClient } from './client'
import { clientBillingTerms, hourBlocks, projects, timeLogs } from './schema'

/**
 * Prepaid hours balance for a single client.
 *
 * `remaining` may be negative — that is a real state (the client has burned
 * past what they purchased), not an error to clamp.
 */
export type ClientHoursTotals = {
  purchased: number
  used: number
  remaining: number
}

const EMPTY_TOTALS: ClientHoursTotals = { purchased: 0, used: 0, remaining: 0 }

/**
 * Null-safe lookup. Projects without a client (PERSONAL/INTERNAL) have no
 * balance, and a client absent from the map has simply never purchased or
 * logged anything — both are zero, not missing data.
 *
 * NOTE: this cannot distinguish "queried and genuinely zero" from "never
 * queried". Callers that pass an empty map to `assembleProjectsWithRelations`
 * therefore render a zero burndown rather than failing — that is intentional
 * for surfaces that never display it (project switchers, the projects landing
 * page, which reads client hours from `fetchClientsWithMetrics` instead). If
 * you add a consumer that reads `project.burndown`, make sure its data path
 * actually passes real totals.
 */
export function clientHoursTotalsFor(
  totals: Map<string, ClientHoursTotals>,
  clientId: string | null | undefined
): ClientHoursTotals {
  if (!clientId) {
    return EMPTY_TOTALS
  }
  return totals.get(clientId) ?? EMPTY_TOTALS
}

/**
 * Start of the client's CURRENT prepaid era: the earliest prepaid term that is
 * already in effect and begins after the last non-prepaid term that is already
 * in effect. Everything before it belongs to a closed era.
 *
 * Three things this deliberately handles, each of which `max(effective_from)`
 * got wrong:
 *
 * 1. Future-dated terms are excluded (`effective_from <= CURRENT_DATE`).
 *    `update-client.ts` flips the `clients.billing_type` cache column
 *    immediately while dating the term to next month, so a client scheduled to
 *    become prepaid renders a burndown NOW. Selecting that future boundary
 *    clipped every logged hour away and reported the full purchased amount as
 *    remaining.
 * 2. Consecutive same-type terms take the era's START, not the latest row. A
 *    same-month edit-then-revert can upsert a second prepaid term; `max` would
 *    jump the boundary forward and discard usage that legitimately drew down.
 * 3. A client with no prepaid term at all falls back to `0001-01-01`, i.e.
 *    count everything — matching the old behaviour for net_30-only clients.
 */
function prepaidEraStart(clientIdRef: AnyColumn) {
  return sql`COALESCE((
    SELECT min(era.effective_from)
    FROM ${clientBillingTerms} era
    WHERE era.client_id = ${clientIdRef}
      AND era.billing_type = 'prepaid'
      AND era.deleted_at IS NULL
      AND era.effective_from <= CURRENT_DATE
      AND era.effective_from > COALESCE((
        SELECT max(prior.effective_from)
        FROM ${clientBillingTerms} prior
        WHERE prior.client_id = ${clientIdRef}
          AND prior.billing_type <> 'prepaid'
          AND prior.deleted_at IS NULL
          AND prior.effective_from <= CURRENT_DATE
      ), DATE '0001-01-01')
  ), DATE '0001-01-01')`
}

/**
 * THE authoritative prepaid burndown for a set of clients. Every surface that
 * shows "hours remaining" — internal clients list, projects list, project
 * workspace header/overview, client portal — must read it from here.
 *
 * Both sides of the subtraction are scoped to the CLIENT, never to whichever
 * projects a given page happens to have loaded. Deriving the client total from
 * a partial set of project rows is what made the project workspace header
 * disagree with the clients list.
 *
 * Both sides are also scoped to the SAME prepaid era. Hours expire when a
 * client switches to net_30: blocks bought in a closed era are not credited,
 * and hours logged in one were invoiced at the time rather than drawn down.
 * Clipping only one side would credit old purchases against no usage (or
 * charge old usage against no purchase).
 *
 * - purchased: live hour blocks whose `billing_month` falls in the current era.
 * - used: live time logs on the client's live CLIENT projects, logged on or
 *   after the era start.
 */
export async function getClientHoursTotals(
  db: DbClient,
  clientIds: string[]
): Promise<Map<string, ClientHoursTotals>> {
  const totals = new Map<string, ClientHoursTotals>()
  if (clientIds.length === 0) {
    return totals
  }

  const [purchasedRows, usedRows] = await Promise.all([
    db
      .select({
        clientId: hourBlocks.clientId,
        purchased: sql<string>`coalesce(sum(${hourBlocks.hoursPurchased}), 0)`,
      })
      .from(hourBlocks)
      .where(
        and(
          inArray(hourBlocks.clientId, clientIds),
          isNull(hourBlocks.deletedAt),
          sql`${hourBlocks.billingMonth} >= ${prepaidEraStart(hourBlocks.clientId)}`
        )
      )
      .groupBy(hourBlocks.clientId),
    db
      .select({
        clientId: projects.clientId,
        used: sql<string>`coalesce(sum(${timeLogs.hours}), 0)`,
      })
      .from(timeLogs)
      .innerJoin(projects, eq(timeLogs.projectId, projects.id))
      .where(
        and(
          inArray(projects.clientId, clientIds),
          isNull(timeLogs.deletedAt),
          isNull(projects.deletedAt),
          // Only client work draws down a prepaid balance. Redundant while
          // `save-project.ts` nulls `clientId` for non-CLIENT projects, but the
          // schema does not enforce that pairing, and the monthly-close queries
          // all carry the same guard.
          eq(projects.type, 'CLIENT'),
          sql`${timeLogs.loggedOn} >= ${prepaidEraStart(projects.clientId)}`
        )
      )
      .groupBy(projects.clientId),
  ])

  const purchasedByClient = new Map<string, number>()
  for (const row of purchasedRows) {
    if (!row.clientId) continue
    purchasedByClient.set(row.clientId, toHours(row.purchased))
  }

  const usedByClient = new Map<string, number>()
  for (const row of usedRows) {
    if (!row.clientId) continue
    usedByClient.set(row.clientId, toHours(row.used))
  }

  for (const clientId of clientIds) {
    const purchased = purchasedByClient.get(clientId) ?? 0
    const used = usedByClient.get(clientId) ?? 0
    totals.set(clientId, { purchased, used, remaining: purchased - used })
  }

  return totals
}

/** numeric columns come back from postgres.js as strings. */
function toHours(value: string | number | null): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}
