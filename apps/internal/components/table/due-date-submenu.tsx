'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseISO } from 'date-fns'
import { CalendarDays, CalendarX2 } from 'lucide-react'

import { Calendar } from '@pts/ui/calendar'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@pts/ui/context-menu'
import { companyCalendarDate, formatCalendarDate } from '@pts/ui/dates'

import { toastLink, useToast } from '@/components/ui/use-toast'
import {
  parseCalendarDate,
  toCalendarDate,
  WEEK_STARTS_ON,
} from '@/lib/dates/calendar-date'
import type { SheetEntityKey } from '@/lib/sheets/entities'

import { keepCalendarKeys, quickDueDates } from './due-date-picks'
import {
  setOptimisticDueOn,
  settleOptimisticDueOn,
  useOptimisticDueOn,
} from '@/lib/tasks/optimistic-due-on'

export type DueDateMenuConfig = {
  /** The due date the record holds (`YYYY-MM-DD`), or null. */
  current: string | null
  /** The server action: sets the due date, or clears it with null. */
  set: (dueOn: string | null) => Promise<{ error?: string }>
  /** The record's name, for the toast's link. */
  name: string
  /** Lists that hold their own copy of the record refetch it here. */
  onChanged?: () => void
}

/**
 * "Set due date ›" in a task's right-click menu: Today, Tomorrow and Next
 * Monday, a calendar for any other day, then "Clear due date". The card
 * shows the new date at once; the save confirms with a toast linking to the
 * task, and a failure puts the old date back.
 */
export function DueDateSubmenu({
  entity,
  id,
  current,
  set,
  name,
  onChanged,
  onPicked,
}: DueDateMenuConfig & {
  entity: SheetEntityKey
  id: string
  /** Closes the menu after a calendar pick (menu items close it already). */
  onPicked: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const shown = useOptimisticDueOn({ id, due_on: current })
  const selected = parseCalendarDate(shown)
  // Today in the company's time zone, as the card's "Due today" counts it,
  // so a late-evening pick on the East Coast still lands on the day it says.
  const today = parseISO(companyCalendarDate())

  const choose = (dueOn: string | null) => {
    if (dueOn === shown) return
    const token = setOptimisticDueOn(id, current, dueOn)
    startTransition(async () => {
      const result = await set(dueOn).catch(() => ({
        error: 'Something went wrong. Try again.',
      }))
      settleOptimisticDueOn(id, token, !result.error)
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Unable to set due date',
          description: result.error,
          link: toastLink(entity, id),
        })
        return
      }
      toast({
        title: dueOn ? `Due ${formatCalendarDate(dueOn)}` : 'Due date cleared',
        description: name,
        link: toastLink(entity, id),
      })
      onChanged?.()
      router.refresh()
    })
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <CalendarDays />
        Set due date
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className='min-w-48'>
        {quickDueDates(today).map(pick => (
          <ContextMenuItem key={pick.label} onClick={() => choose(pick.value)}>
            {pick.label}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        {/* The calendar keeps its own arrow keys: stopping them here, after
            the day buttons have handled them, keeps the menu from taking
            them to move between items. Escape and Tab still reach it. */}
        <div role='presentation' onKeyDown={keepCalendarKeys}>
          <Calendar
            mode='single'
            className='bg-transparent p-1'
            selected={selected}
            defaultMonth={selected ?? today}
            today={today}
            weekStartsOn={WEEK_STARTS_ON}
            onSelect={date => {
              if (date) choose(toCalendarDate(date))
              onPicked()
            }}
          />
        </div>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!shown} onClick={() => choose(null)}>
          <CalendarX2 />
          Clear due date
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}
