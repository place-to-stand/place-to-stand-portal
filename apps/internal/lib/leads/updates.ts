import {
  CalendarDays,
  Mail,
  Phone,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'

import { leadUpdateType } from '@/lib/db/schema'
import { isTerminalLeadStatus, type LeadStatusValue } from './constants'

export const LEAD_UPDATE_TYPES = leadUpdateType.enumValues

export type LeadUpdateTypeValue = (typeof LEAD_UPDATE_TYPES)[number]

export const LEAD_UPDATE_LABELS: Record<LeadUpdateTypeValue, string> = {
  MEETING: 'Meeting',
  PHONE_CALL: 'Phone call',
  EMAIL: 'Email',
  NOTE: 'Note',
}

/**
 * Per-type color tokens, in the shape of LEAD_STATUS_TOKENS.
 *
 * Color is never the sole signal (WCAG 1.4.1) — every timeline entry renders
 * the icon AND the text label alongside this token. Do not "simplify" an entry
 * down to a bare colored dot.
 */
export const LEAD_UPDATE_TOKENS: Record<LeadUpdateTypeValue, string> = {
  MEETING:
    'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  PHONE_CALL:
    'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  EMAIL:
    'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  NOTE: 'border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
}

export const LEAD_UPDATE_ICONS: Record<LeadUpdateTypeValue, LucideIcon> = {
  MEETING: CalendarDays,
  PHONE_CALL: Phone,
  EMAIL: Mail,
  NOTE: StickyNote,
}

/**
 * Types that count as contact with the lead. NOTE is excluded — an internal
 * observation is not a touch, and counting it would make a lead look recently
 * contacted when nobody reached out. See §03 last-touch derivation.
 *
 * This is the single source of truth for the exclusion (PRD 005 C5). The
 * last-touch query imports it; never re-list the literals.
 */
export const LEAD_TOUCH_TYPES = [
  'MEETING',
  'PHONE_CALL',
  'EMAIL',
] as const satisfies ReadonlyArray<LeadUpdateTypeValue>

/**
 * Per-stage follow-up cadence FALLBACK, in days without a touch.
 *
 * This is not the source of truth — `lead_stage_settings` is (§06, D22). It is
 * the middle rung of a three-step resolution:
 *
 *   configured row  →  this constant  →  null (never stale)
 *
 * Deleting it once the table exists would mean a missing row, a failed fetch, or
 * a fresh database silently disables staleness — which looks exactly like the
 * feature working correctly on a quiet board (C14). Keep the layering.
 *
 * Terminal statuses are never stale, so they are absent by design.
 */
export const LEAD_STALE_AFTER_DAYS: Partial<
  Record<LeadStatusValue, number>
> = {
  NEW_OPPORTUNITIES: 3,
  ACTIVE_OPPORTUNITIES: 7,
  PROPOSAL_SENT: 7,
  ON_ICE: 30,
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * The configured thresholds, as either the `Map` the server query returns or
 * the plain object it flattens into when it crosses the RSC boundary.
 */
export type LeadStaleThresholdSource =
  | Map<LeadStatusValue, number | null>
  | Partial<Record<LeadStatusValue, number | null>>

function readThreshold(
  source: LeadStaleThresholdSource,
  status: LeadStatusValue
): { configured: boolean; value: number | null } {
  if (source instanceof Map) {
    return { configured: source.has(status), value: source.get(status) ?? null }
  }

  return {
    configured: Object.hasOwn(source, status),
    value: source[status] ?? null,
  }
}

/**
 * Resolve the configured threshold for a status, in days.
 *
 * The "no row" and "row explicitly set to null" cases must stay distinct: the
 * first falls through to `LEAD_STALE_AFTER_DAYS`, the second means the stage was
 * deliberately configured to never go stale and resolution stops (C14). A
 * `?? fallback` would silently merge them and resurrect a default the team had
 * turned off.
 */
export function resolveStaleAfterDays(
  status: LeadStatusValue,
  thresholds: LeadStaleThresholdSource
): number | null {
  if (isTerminalLeadStatus(status)) {
    return null
  }

  const { configured, value } = readThreshold(thresholds, status)

  if (configured) {
    return value
  }

  return LEAD_STALE_AFTER_DAYS[status] ?? null
}

/**
 * Whether a lead is overdue for follow-up.
 *
 * Takes the resolved threshold map rather than importing the constant, so a
 * value tuned on /leads/settings actually reaches the board (§06).
 *
 * A lead with no logged touch ages from `createdAt` — otherwise a lead nobody
 * has ever contacted would be the one thing the board never flags.
 */
export function isLeadStale(
  status: LeadStatusValue,
  lastTouchAt: string | null,
  createdAt: string,
  thresholds: LeadStaleThresholdSource,
  now: Date = new Date()
): boolean {
  const staleAfterDays = resolveStaleAfterDays(status, thresholds)

  if (staleAfterDays === null) {
    return false
  }

  const since = new Date(lastTouchAt ?? createdAt).getTime()

  if (Number.isNaN(since)) {
    return false
  }

  return now.getTime() - since > staleAfterDays * MS_PER_DAY
}

/**
 * Whole days since the last touch (or since creation when nothing is logged).
 * Used for the dot's tooltip and the sheet's last-touch summary.
 */
export function daysSinceTouch(
  lastTouchAt: string | null,
  createdAt: string,
  now: Date = new Date()
): number {
  const since = new Date(lastTouchAt ?? createdAt).getTime()

  if (Number.isNaN(since)) {
    return 0
  }

  return Math.max(0, Math.floor((now.getTime() - since) / MS_PER_DAY))
}
