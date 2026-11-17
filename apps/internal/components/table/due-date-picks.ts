import type { KeyboardEvent } from 'react'
import { addDays, nextMonday } from 'date-fns'

import { toCalendarDate } from '@/lib/dates/calendar-date'

/**
 * The quick picks every "Set due date" menu offers (a card's, and the
 * board's bulk bar), from today in the company's time zone.
 */
export function quickDueDates(today: Date) {
  return [
    { label: 'Today', value: toCalendarDate(today) },
    { label: 'Tomorrow', value: toCalendarDate(addDays(today, 1)) },
    { label: 'Next Monday', value: toCalendarDate(nextMonday(today)) },
  ]
}

/**
 * A calendar inside a menu keeps its own arrow keys: stopping them after the
 * day buttons have handled them keeps the menu from taking them to move
 * between items. Escape and Tab still reach the menu.
 */
export function keepCalendarKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation()
}
