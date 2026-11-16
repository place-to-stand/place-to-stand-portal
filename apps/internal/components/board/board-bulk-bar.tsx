'use client'

import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
import { CalendarDays, CalendarX2, ChevronDown, UserRoundX } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Calendar } from '@pts/ui/calendar'
import { companyCalendarDate, formatCalendarDate } from '@pts/ui/dates'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'

import {
  bulkSetLeadAssignee,
  bulkSetTaskAssignee,
  bulkSetTaskDueDate,
} from '@/app/(dashboard)/_actions/board-bulk'
import { PersonAvatar } from '@/components/table/assignee-submenu'
import {
  BulkActionBar,
  type BulkOptimistic,
  type RunBulkAction,
} from '@/components/table/bulk-select'
import {
  keepCalendarKeys,
  quickDueDates,
} from '@/components/table/due-date-picks'
import type { AssigneeOption } from '@/lib/assignees/types'
import { idsToPutBack } from '@/lib/dnd/board-selection'
import { toCalendarDate, WEEK_STARTS_ON } from '@/lib/dates/calendar-date'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import { MUTED_STATE_MARK_CLASS } from '@/lib/entity-state-icon'
import { getJson } from '@/lib/http/get-json'
import {
  setOptimisticDueOn,
  settleOptimisticDueOn,
} from '@/lib/tasks/optimistic-due-on'

import type { BoardSelection } from './board-selection'

type BoardBulkBarProps = {
  selection: BoardSelection
  /** A card's name, for naming refused cards in the toast. */
  nameOf: (id: string) => string | undefined
} & (
  | {
      entity: 'task'
      /** A task's due date as the board holds it (for the instant change). */
      dueOnOf: (id: string) => string | null
      /** The task's project (or lead): who can take it depends on it. */
      groupOf: (id: string) => string
    }
  | { entity: 'lead' }
)

/**
 * The bulk bar on a board, once cards are selected: Set assignee, Set due
 * date (tasks), Archive and clear, the same actions as a card's right-click
 * menu, run over every selected card. Archive and due dates show on the
 * board at once and put back any card the save refused.
 */
export function BoardBulkBar(props: BoardBulkBarProps) {
  const { selection, nameOf, entity } = props

  // Cards leave the board as the archive starts; refused ones come back.
  const optimisticArchive: BulkOptimistic = ids => {
    const show = selection.hide(ids)
    return result => show(idsToPutBack(ids, result))
  }

  return (
    <BulkActionBar
      selection={selection}
      entity={entity}
      mode='active'
      nameOf={nameOf}
      optimisticArchive={optimisticArchive}
      controls={(run, pending) => (
        <>
          <AssigneeMenu
            entity={entity}
            optionsUrls={
              props.entity === 'lead'
                ? ['/api/leads/assignee-options']
                : taskOptionsUrls(selection.ids, props.groupOf)
            }
            run={run}
            disabled={pending}
          />
          {props.entity === 'task' ? (
            <DueDateMenu run={run} disabled={pending} dueOnOf={props.dueOnOf} />
          ) : null}
        </>
      )}
    />
  )
}

/**
 * Who can take a task depends on its project (or lead), so the menu asks
 * once per project among the selected tasks and offers the people who can
 * take all of them.
 */
function taskOptionsUrls(
  ids: ReadonlySet<string>,
  groupOf: (id: string) => string
) {
  const oneTaskPerGroup = new Map<string, string>()
  ids.forEach(id => {
    const group = groupOf(id)
    if (!oneTaskPerGroup.has(group)) oneTaskPerGroup.set(group, id)
  })
  return [...oneTaskPerGroup.values()]
    .sort()
    .map(id => `/api/tasks/${id}/assignee-options`)
}

/** The people every list offers, in the first list's order. */
function peopleInAll(lists: AssigneeOption[][]) {
  const [first = [], ...rest] = lists
  return first.filter(person =>
    rest.every(list => list.some(other => other.id === person.id))
  )
}

const UserIcon = ENTITY_ICONS.user

function AssigneeMenu({
  entity,
  optionsUrls,
  run,
  disabled,
}: {
  entity: 'task' | 'lead'
  optionsUrls: string[]
  run: RunBulkAction
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const options = useQueries({
    queries: optionsUrls.map(url => ({
      queryKey: ['assigneeOptions', url],
      queryFn: () => getJson<AssigneeOption[]>(url),
      staleTime: 30_000,
      enabled: open,
    })),
    combine: results => ({
      isPending: results.some(result => result.isPending),
      isError: results.some(result => result.isError),
      data: results.every(result => result.data)
        ? peopleInAll(results.map(result => result.data ?? []))
        : [],
    }),
  })
  const save = entity === 'lead' ? bulkSetLeadAssignee : bulkSetTaskAssignee

  const choose = (person: AssigneeOption | null) =>
    run(
      person
        ? { verb: 'assign', past: `assigned to ${person.name}` }
        : { verb: 'clear the assignee of', past: 'unassigned' },
      'assignee',
      selection => save({ selection, assigneeId: person?.id ?? null })
    )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button type='button' variant='outline' size='sm'>
          <UserIcon className={MUTED_STATE_MARK_CLASS} />
          Set assignee
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side='top' className='min-w-48'>
        {options.isPending ? (
          <DropdownMenuItem disabled>Loading people…</DropdownMenuItem>
        ) : options.isError ? (
          <DropdownMenuItem disabled>Unable to load people.</DropdownMenuItem>
        ) : (
          options.data.map(person => (
            <DropdownMenuItem key={person.id} onClick={() => choose(person)}>
              <PersonAvatar person={person} />
              <span className='truncate'>{person.name}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => choose(null)}>
          <UserRoundX />
          Clear assignee
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DueDateMenu({
  run,
  disabled,
  dueOnOf,
}: {
  run: RunBulkAction
  disabled: boolean
  dueOnOf: (id: string) => string | null
}) {
  const [open, setOpen] = useState(false)
  // Today in the company's time zone, as the card's "Due today" counts it.
  const today = parseISO(companyCalendarDate())

  const choose = (dueOn: string | null) => {
    setOpen(false)
    run(
      dueOn
        ? {
            verb: 'set the due date of',
            past: `due ${formatCalendarDate(dueOn)}`,
          }
        : { verb: 'clear the due date of', past: 'with no due date' },
      'due date',
      selection => bulkSetTaskDueDate({ selection, dueOn }),
      // The cards show the new date at once; refused ones go back.
      ids => {
        const tokens = ids.map(id => setOptimisticDueOn(id, dueOnOf(id), dueOn))
        return result => {
          const putBack = new Set(idsToPutBack(ids, result))
          ids.forEach((id, index) =>
            settleOptimisticDueOn(id, tokens[index], !putBack.has(id))
          )
        }
      }
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button type='button' variant='outline' size='sm'>
          <CalendarDays />
          Set due date
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side='top' className='min-w-48'>
        {quickDueDates(today).map(pick => (
          <DropdownMenuItem key={pick.label} onClick={() => choose(pick.value)}>
            {pick.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div role='presentation' onKeyDown={keepCalendarKeys}>
          <Calendar
            mode='single'
            className='bg-transparent p-1'
            defaultMonth={today}
            today={today}
            weekStartsOn={WEEK_STARTS_ON}
            onSelect={date => {
              if (date) choose(toCalendarDate(date))
            }}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => choose(null)}>
          <CalendarX2 />
          Clear due date
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
