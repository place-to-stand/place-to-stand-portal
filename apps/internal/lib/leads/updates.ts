import {
  CalendarDays,
  Mail,
  Phone,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'

import { leadUpdateType } from '@/lib/db/schema'

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

const MS_PER_DAY = 24 * 60 * 60 * 1000

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
