import { BADGE_TINTS } from '@pts/ui/badge-tints'
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
  MEETING: BADGE_TINTS.violet,
  PHONE_CALL: BADGE_TINTS.sky,
  EMAIL: BADGE_TINTS.amber,
  NOTE: BADGE_TINTS.neutral,
}

export const LEAD_UPDATE_ICONS: Record<LeadUpdateTypeValue, LucideIcon> = {
  MEETING: CalendarDays,
  PHONE_CALL: Phone,
  EMAIL: Mail,
  NOTE: StickyNote,
}
