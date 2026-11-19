import 'server-only'

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm'

import { db } from '@/lib/db'
import { invoices, systemRuns } from '@/lib/db/schema'

/** What a row in `system_runs` records. */
export type SystemRunKind = 'job' | 'stripe'
export type SystemRunOutcome = 'ok' | 'failed' | 'unmatched'

/** How long runs are kept; the weekly prune job deletes older rows. */
export const SYSTEM_RUN_DAYS = 90

/**
 * Records one run. Never throws: health records must not break the work
 * they describe (and before migration 0139 the table doesn't exist).
 */
export async function recordSystemRun(run: {
  kind: SystemRunKind
  name: string
  outcome: SystemRunOutcome
  detail?: string | null
  /** Stripe's event id, so a retry that worked clears the failure. */
  ref?: string | null
  durationMs?: number | null
}) {
  try {
    await db.insert(systemRuns).values({
      kind: run.kind,
      name: run.name,
      outcome: run.outcome,
      detail: run.detail?.slice(0, 500) ?? null,
      ref: run.ref ?? null,
      durationMs: run.durationMs ?? null,
    })
  } catch (error) {
    console.error('Failed to record a system run', run.name, error)
  }
}

/**
 * Wraps a scheduled job's route handler so each run is recorded: how long
 * it took, whether it answered OK, and its JSON `data` as the detail.
 * A request without the cron secret (no Authorization header, or a 401)
 * isn't a run and isn't recorded, so stray hits can't paint a job red.
 */
export function withJobRun<TRequest extends Request>(
  path: string,
  handler: (request: TRequest) => Promise<Response>
) {
  return async (request: TRequest): Promise<Response> => {
    if (!request.headers.get('authorization')) return handler(request)
    const started = Date.now()
    let response: Response
    try {
      response = await handler(request)
    } catch (error) {
      await recordSystemRun({
        kind: 'job',
        name: path,
        outcome: 'failed',
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      })
      throw error
    }
    if (response.status === 401) return response
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { data?: unknown; error?: unknown } | null
    const detail = response.ok ? body?.data : (body?.error ?? response.status)
    await recordSystemRun({
      kind: 'job',
      name: path,
      outcome: response.ok ? 'ok' : 'failed',
      detail: detail === undefined ? null : JSON.stringify(detail),
      durationMs: Date.now() - started,
    })
    return response
  }
}

export type JobRunSummary = {
  lastRunAt: string | null
  lastOutcome: SystemRunOutcome | null
  lastDetail: string | null
  lastDurationMs: number | null
  lastOkAt: string | null
  failedLastWeek: number
}

const EMPTY_JOB: JobRunSummary = {
  lastRunAt: null,
  lastOutcome: null,
  lastDetail: null,
  lastDurationMs: null,
  lastOkAt: null,
  failedLastWeek: 0,
}

/** Latest run, latest success and failures this week, per job path. */
export async function readJobRuns(
  paths: string[]
): Promise<Map<string, JobRunSummary>> {
  const result = new Map(paths.map(path => [path, { ...EMPTY_JOB }]))
  try {
    const rows = await db
      .select({
        name: systemRuns.name,
        lastRunAt: sql<string | null>`max(${systemRuns.createdAt})`,
        lastOkAt: sql<
          string | null
        >`max(${systemRuns.createdAt}) filter (where ${systemRuns.outcome} = 'ok')`,
        failedLastWeek: sql<number>`(count(*) filter (where ${systemRuns.outcome} = 'failed' and ${systemRuns.createdAt} > now() - interval '7 days'))::int`,
      })
      .from(systemRuns)
      .where(eq(systemRuns.kind, 'job'))
      .groupBy(systemRuns.name)
    const latest = await db
      .selectDistinctOn([systemRuns.name], {
        name: systemRuns.name,
        outcome: systemRuns.outcome,
        detail: systemRuns.detail,
        durationMs: systemRuns.durationMs,
      })
      .from(systemRuns)
      .where(eq(systemRuns.kind, 'job'))
      .orderBy(systemRuns.name, desc(systemRuns.createdAt))
    const last = new Map(latest.map(row => [row.name, row]))
    for (const row of rows) {
      const entry = result.get(row.name)
      if (!entry) continue
      const latestRow = last.get(row.name)
      Object.assign(entry, {
        lastRunAt: row.lastRunAt,
        lastOkAt: row.lastOkAt,
        failedLastWeek: row.failedLastWeek,
        lastOutcome: (latestRow?.outcome as SystemRunOutcome) ?? null,
        lastDetail: latestRow?.detail ?? null,
        lastDurationMs: latestRow?.durationMs ?? null,
      })
    }
  } catch (error) {
    // Before migration 0139: show the jobs without runs.
    console.error('Failed to read job runs', error)
  }
  return result
}

export type StripeHealth = {
  /** False before migration 0139, when nothing can be shown. */
  recorded: boolean
  lastEventAt: string | null
  booked30d: number
  unmatched30d: number
  failed30d: number
  recentProblems: {
    at: string
    name: string
    outcome: SystemRunOutcome
    detail: string | null
  }[]
}

/**
 * A Stripe row that still needs a look: not ok, in the last 30 days, and not
 * followed by a later row for the same event that worked (Stripe retries a
 * failed delivery, and the retry clears it).
 */
function openStripeProblem() {
  return and(
    eq(systemRuns.kind, 'stripe'),
    sql`${systemRuns.outcome} <> 'ok'`,
    gte(systemRuns.createdAt, sql`now() - interval '30 days'`),
    sql.raw(
      `not exists (select 1 from system_runs later where later.kind = 'stripe' and later.ref = "system_runs"."ref" and later.outcome <> 'failed' and later.created_at > "system_runs"."created_at")`
    )
  )
}

/** Stripe events in the last 30 days, and the latest ones that need a look. */
export async function readStripeHealth(): Promise<StripeHealth> {
  try {
    const [[last], [open], [paid], problems] = await Promise.all([
      db
        .select({ at: sql<string | null>`max(${systemRuns.createdAt})` })
        .from(systemRuns)
        .where(eq(systemRuns.kind, 'stripe')),
      db
        .select({
          unmatched: sql<number>`(count(*) filter (where ${systemRuns.outcome} = 'unmatched'))::int`,
          failed: sql<number>`(count(*) filter (where ${systemRuns.outcome} = 'failed'))::int`,
        })
        .from(systemRuns)
        .where(openStripeProblem()),
      // Booked comes from the invoices themselves, so a payment booked by a
      // retry after a crash still counts.
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(
          and(
            eq(invoices.status, 'PAID'),
            isNull(invoices.deletedAt),
            gte(invoices.paidAt, sql`now() - interval '30 days'`),
            or(
              isNotNull(invoices.stripePaymentIntentId),
              isNotNull(invoices.stripeCheckoutSessionId)
            )
          )
        ),
      db
        .select({
          at: systemRuns.createdAt,
          name: systemRuns.name,
          outcome: systemRuns.outcome,
          detail: systemRuns.detail,
        })
        .from(systemRuns)
        .where(openStripeProblem())
        .orderBy(desc(systemRuns.createdAt))
        .limit(5),
    ])
    return {
      recorded: true,
      lastEventAt: last?.at ?? null,
      booked30d: paid?.count ?? 0,
      unmatched30d: open?.unmatched ?? 0,
      failed30d: open?.failed ?? 0,
      recentProblems: problems.map(row => ({
        ...row,
        outcome: row.outcome as SystemRunOutcome,
      })),
    }
  } catch (error) {
    console.error('Failed to read Stripe health', error)
    return {
      recorded: false,
      lastEventAt: null,
      booked30d: 0,
      unmatched30d: 0,
      failed30d: 0,
      recentProblems: [],
    }
  }
}

const PRUNE_BATCH = 1000

/** Deletes runs older than SYSTEM_RUN_DAYS, in batches. Returns the count. */
export async function pruneSystemRuns(): Promise<number> {
  let deletedCount = 0
  for (;;) {
    const batch = db
      .select({ id: systemRuns.id })
      .from(systemRuns)
      .where(
        lt(
          systemRuns.createdAt,
          sql`now() - make_interval(days => ${SYSTEM_RUN_DAYS})`
        )
      )
      .limit(PRUNE_BATCH)
    const deleted = await db
      .delete(systemRuns)
      .where(inArray(systemRuns.id, batch))
      .returning({ id: systemRuns.id })
    deletedCount += deleted.length
    if (deleted.length < PRUNE_BATCH) return deletedCount
  }
}
