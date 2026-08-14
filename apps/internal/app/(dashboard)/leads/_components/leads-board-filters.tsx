'use client'

import { useMemo } from 'react'

import { Button } from '@pts/ui/button'
import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { ResetFiltersButton } from '@/components/table-toolbar/reset-filters-button'
import { useListParams } from '@/hooks/use-list-params'
import type { LeadAssigneeOption } from '@/lib/leads/types'
import { cn } from '@/lib/utils'

export const FOLLOW_UP_PARAM = 'followUp'
export const ASSIGNEE_PARAM = 'assignee'

/** The toggle is a presence flag, not a value — `?followUp=1` or absent. */
const FOLLOW_UP_ON = '1'

export type LeadsBoardFilters = {
  needsFollowUp: boolean
  assigneeId: string | undefined
  toggleFollowUp: () => void
  setAssignee: (value: string | undefined) => void
  hasActiveFilters: boolean
  reset: () => void
}

/**
 * Filter state for the leads board, held in URL params (D23).
 *
 * The params are where the state LIVES; the filtering itself is client-side
 * over the already-loaded board. `fetchLeadsBoard` returns every active lead,
 * so a server round trip would buy nothing and would fight the drag-and-drop
 * state.
 *
 * Both params coexist with `useSheetParamSelection('lead')` on this page —
 * `useListParams` preserves unrelated params, so `?lead=` survives a filter
 * change and vice versa.
 */
export function useLeadsBoardFilters(
  assignees: LeadAssigneeOption[]
): LeadsBoardFilters {
  const { update, getParam, hasActiveFilters, reset } = useListParams({
    basePath: '/leads',
    resetKeys: [],
    filters: {
      [FOLLOW_UP_PARAM]: { isValid: value => value === FOLLOW_UP_ON },
      [ASSIGNEE_PARAM]: {
        isValid: value => assignees.some(assignee => assignee.id === value),
      },
    },
  })

  const needsFollowUp = getParam(FOLLOW_UP_PARAM) === FOLLOW_UP_ON
  const rawAssignee = getParam(ASSIGNEE_PARAM)
  // An unknown assignee id in the URL filters to nothing, which reads as a
  // broken board; treat it as absent instead.
  const assigneeId = assignees.some(assignee => assignee.id === rawAssignee)
    ? rawAssignee
    : undefined

  return {
    needsFollowUp,
    assigneeId,
    toggleFollowUp: () =>
      update({ [FOLLOW_UP_PARAM]: needsFollowUp ? undefined : FOLLOW_UP_ON }),
    setAssignee: value => update({ [ASSIGNEE_PARAM]: value }),
    hasActiveFilters,
    reset,
  }
}

type LeadsBoardFiltersBarProps = {
  filters: LeadsBoardFilters
  assignees: LeadAssigneeOption[]
  /** How many leads are currently flagged, for the toggle's count. */
  staleCount: number
}

/**
 * The leads board had no toolbar at all before this section.
 *
 * Status filtering is deliberately absent (the kanban columns *are* the
 * statuses) and so is search (the command palette covers it).
 */
export function LeadsBoardFiltersBar({
  filters,
  assignees,
  staleCount,
}: LeadsBoardFiltersBarProps) {
  const assigneeOptions = useMemo(
    () =>
      assignees.map(assignee => ({
        value: assignee.id,
        label: assignee.name,
      })),
    [assignees]
  )

  return (
    <FilterBar>
      <Button
        type='button'
        variant={filters.needsFollowUp ? 'default' : 'outline'}
        size='sm'
        aria-pressed={filters.needsFollowUp}
        onClick={filters.toggleFollowUp}
        className='gap-2'
      >
        Needs follow-up
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
            filters.needsFollowUp
              ? 'bg-primary-foreground/20'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {staleCount}
        </span>
      </Button>
      <FilterSelect
        value={filters.assigneeId}
        onChange={filters.setAssignee}
        placeholder='All assignees'
        options={assigneeOptions}
      />
      <ResetFiltersButton
        show={filters.hasActiveFilters}
        onReset={filters.reset}
      />
    </FilterBar>
  )
}
