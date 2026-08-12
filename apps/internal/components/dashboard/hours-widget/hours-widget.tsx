'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { ProjectTimeLogDialog } from '@/app/(dashboard)/projects/_components/project-time-log/project-time-log-dialog'
import { cn } from '@/lib/utils'
import {
  HOURS_WIDGET_LOG_PAGE_SIZE,
  type DashboardTimeLogPage,
  type HoursSnapshot,
} from '@/lib/dashboard/types'
import type {
  ProjectTimeLogDialogParams,
  TimeLogEntry,
} from '@/lib/projects/time-log/types'

import {
  compareMonthCursor,
  formatHours,
  formatMonthLabel,
  shiftMonth,
} from './month-cursor'
import { TimeLogList } from './time-log-list'

const API_ENDPOINT = '/api/dashboard/hours'

type HoursWidgetProps = {
  initialSnapshot: HoursSnapshot
  className?: string
}

export function HoursWidget({ initialSnapshot, className }: HoursWidgetProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDirection, setPendingDirection] = useState<
    'prev' | 'next' | null
  >(null)
  // Log paging lives beside the snapshot rather than inside it: shifting the
  // month replaces the whole snapshot, which resets paging for free.
  const [logs, setLogs] = useState<DashboardTimeLogPage>(
    initialSnapshot.timeLogs
  )
  // Tracked separately from `logs.items.length`: dedupe can drop rows, and
  // deriving the next offset from the deduped count would advance slower than
  // the server consumed, re-requesting overlapping pages forever.
  const [logOffset, setLogOffset] = useState(
    initialSnapshot.timeLogs.items.length
  )
  // Identifies the month whose data is currently on screen, so a response that
  // arrives after the user moved months can be discarded rather than merged.
  const activeCursorRef = useRef(
    `${initialSnapshot.year}-${initialSnapshot.month}`
  )
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  // Edit context is fetched per row on demand; see the route's comment for why
  // it isn't folded into the list payload.
  const [openingEntryId, setOpeningEntryId] = useState<string | null>(null)
  const [editContext, setEditContext] = useState<{
    entry: TimeLogEntry
    params: ProjectTimeLogDialogParams
  } | null>(null)

  const monthLabel = useMemo(
    () => formatMonthLabel(snapshot.year, snapshot.month),
    [snapshot.month, snapshot.year]
  )

  const minLimitLabel = useMemo(
    () => formatMonthLabel(snapshot.minCursor.year, snapshot.minCursor.month),
    [snapshot.minCursor.month, snapshot.minCursor.year]
  )

  const maxLimitLabel = useMemo(
    () => formatMonthLabel(snapshot.maxCursor.year, snapshot.maxCursor.month),
    [snapshot.maxCursor.month, snapshot.maxCursor.year]
  )

  const canGoPrev = useMemo(
    () => compareMonthCursor(snapshot, snapshot.minCursor) > 0,
    [snapshot]
  )

  const canGoNext = useMemo(
    () => compareMonthCursor(snapshot, snapshot.maxCursor) < 0,
    [snapshot]
  )

  const prevDisabled = isLoading || !canGoPrev
  const nextDisabled = isLoading || !canGoNext

  const prevTooltipReason = !canGoPrev
    ? `No time logs before ${minLimitLabel}.`
    : isLoading
      ? pendingDirection === 'prev'
        ? 'Loading previous month...'
        : 'Please wait while we update the month.'
      : null

  const nextTooltipReason = !canGoNext
    ? `No data beyond ${maxLimitLabel} yet.`
    : isLoading
      ? pendingDirection === 'next'
        ? 'Loading next month...'
        : 'Please wait while we update the month.'
      : null

  const handleShift = useCallback(
    async (delta: number) => {
      const direction: 'prev' | 'next' = delta < 0 ? 'prev' : 'next'

      if (isLoading) {
        return
      }
      if (direction === 'prev' && !canGoPrev) {
        return
      }
      if (direction === 'next' && !canGoNext) {
        return
      }

      setIsLoading(true)
      setPendingDirection(direction)
      setError(null)
      const target = shiftMonth(snapshot, delta)

      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(target),
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Request failed')
        }

        const payload = (await response.json()) as HoursSnapshot
        activeCursorRef.current = `${payload.year}-${payload.month}`
        setSnapshot(payload)
        setLogs(payload.timeLogs)
        setLogOffset(payload.timeLogs.items.length)
        setLogError(null)
      } catch (requestError) {
        console.error('Failed to load hours snapshot', requestError)
        setError('Unable to load that month. Please try again.')
      } finally {
        setIsLoading(false)
        setPendingDirection(null)
      }
    },
    [canGoNext, canGoPrev, isLoading, snapshot]
  )

  const handleLoadMoreLogs = useCallback(async () => {
    if (isLoadingLogs) {
      return
    }

    const requestedCursor = `${snapshot.year}-${snapshot.month}`

    setIsLoadingLogs(true)
    setLogError(null)

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: snapshot.year,
          month: snapshot.month,
          logOffset,
        }),
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      const page = (await response.json()) as DashboardTimeLogPage

      // The month can change while this is in flight -- nothing disables
      // navigation during paging -- and appending these rows would splice one
      // month's logs into another's list and totals.
      if (activeCursorRef.current !== requestedCursor) {
        return
      }

      // Advance by what the server actually returned, not by how many survived
      // dedupe, so a row inserted above the boundary can't stall the cursor.
      setLogOffset(current => current + page.items.length)

      setLogs(current => {
        // A log deleted between pages shifts the offset and can re-deliver a
        // row already on screen; dedupe by id so it can't double up.
        const seen = new Set(current.items.map(item => item.id))
        return {
          items: [
            ...current.items,
            ...page.items.filter(item => !seen.has(item.id)),
          ],
          totalCount: page.totalCount,
        }
      })
    } catch (requestError) {
      console.error('Failed to load more time logs', requestError)
      if (activeCursorRef.current === requestedCursor) {
        setLogError('Unable to load more logs. Please try again.')
      }
    } finally {
      setIsLoadingLogs(false)
    }
  }, [isLoadingLogs, logOffset, snapshot.month, snapshot.year])

  /**
   * Re-pulls the current month after an edit so the totals and the row's own
   * text reflect the change. Asks for however many rows are already on screen
   * so a user who paged down three times isn't snapped back to five.
   */
  const refreshCurrentMonth = useCallback(async () => {
    const loadedCount = Math.max(logs.items.length, HOURS_WIDGET_LOG_PAGE_SIZE)

    try {
      const [snapshotResponse, pageResponse] = await Promise.all([
        fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: snapshot.year, month: snapshot.month }),
          cache: 'no-store',
        }),
        fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: snapshot.year,
            month: snapshot.month,
            logOffset: 0,
            logLimit: loadedCount,
          }),
          cache: 'no-store',
        }),
      ])

      if (!snapshotResponse.ok || !pageResponse.ok) {
        throw new Error('Request failed')
      }

      const nextSnapshot = (await snapshotResponse.json()) as HoursSnapshot
      const nextPage = (await pageResponse.json()) as DashboardTimeLogPage

      setSnapshot(nextSnapshot)
      setLogs(nextPage)
      setLogOffset(nextPage.items.length)
    } catch (requestError) {
      console.error('Failed to refresh hours after edit', requestError)
      setLogError('Saved, but the list is out of date. Reload to see it.')
    }
  }, [logs.items.length, snapshot.month, snapshot.year])

  const handleOpenEntry = useCallback(async (entryId: string) => {
    setOpeningEntryId(entryId)
    setLogError(null)

    try {
      const response = await fetch(`/api/dashboard/time-logs/${entryId}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as {
        ok: boolean
        data?: { entry: TimeLogEntry; params: ProjectTimeLogDialogParams }
        error?: string
      }

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error ?? 'Request failed')
      }

      setEditContext(payload.data)
    } catch (requestError) {
      console.error('Failed to open time log', requestError)
      setLogError('Unable to open that log. Please try again.')
    } finally {
      setOpeningEntryId(null)
    }
  }, [])

  return (
    <section
      className={cn(
        'bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='hours-widget-heading'
    >
      <header className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5'>
        <h2 id='hours-widget-heading' className='text-sm font-semibold'>
          Monthly Hours Snapshot
        </h2>
        <div className='flex items-center gap-1.5'>
          <p className='mr-1 text-xs font-medium whitespace-nowrap'>
            {monthLabel}
          </p>
          <DisabledFieldTooltip
            disabled={prevDisabled}
            reason={prevTooltipReason}
          >
            <Button
              type='button'
              variant='outline'
              size='icon-sm'
              onClick={() => handleShift(-1)}
              disabled={prevDisabled}
              aria-label='View previous month'
            >
              {isLoading && pendingDirection === 'prev' ? (
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
              ) : (
                <ChevronLeft className='h-4 w-4' aria-hidden />
              )}
            </Button>
          </DisabledFieldTooltip>
          <DisabledFieldTooltip
            disabled={nextDisabled}
            reason={nextTooltipReason}
          >
            <Button
              type='button'
              variant='outline'
              size='icon-sm'
              onClick={() => handleShift(1)}
              disabled={nextDisabled}
              aria-label='View next month'
            >
              {isLoading && pendingDirection === 'next' ? (
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
              ) : (
                <ChevronRight className='h-4 w-4' aria-hidden />
              )}
            </Button>
          </DisabledFieldTooltip>
        </div>
      </header>
      <div className='flex flex-1 flex-col gap-3 px-4 py-3'>
        <div className='grid grid-cols-3 gap-2'>
          <StatCard
            label='My billable hours'
            value={formatHours(snapshot.myHours)}
            variant='primary'
          />
          <StatCard
            label='Total billable hours'
            value={formatHours(snapshot.companyHours)}
            variant='muted'
          />
          <StatCard
            label='Hours prepaid'
            value={formatHours(snapshot.companyHoursPrepaid)}
            variant='muted'
          />
        </div>
        {error ? <p className='text-destructive text-xs'>{error}</p> : null}
        <TimeLogList
          items={logs.items}
          totalCount={logs.totalCount}
          isLoadingMore={isLoadingLogs}
          onLoadMore={handleLoadMoreLogs}
          onOpenEntry={handleOpenEntry}
          openingEntryId={openingEntryId}
          error={logError}
        />
      </div>
      {editContext ? (
        <ProjectTimeLogDialog
          {...editContext.params}
          open
          onOpenChange={next => {
            if (!next) {
              setEditContext(null)
            }
          }}
          mode='edit'
          timeLogEntry={editContext.entry}
          onMutationSuccess={() => {
            setEditContext(null)
            void refreshCurrentMonth()
          }}
        />
      ) : null}
    </section>
  )
}

type StatCardProps = {
  label: string
  value: string
  variant?: 'primary' | 'muted'
}

function StatCard({ label, value, variant = 'primary' }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        variant === 'muted' && 'bg-muted/50'
      )}
    >
      <p className='text-muted-foreground text-[10px] leading-tight font-medium tracking-wide uppercase'>
        {label}
      </p>
      <p className='text-foreground mt-0.5 text-xl leading-tight font-semibold tabular-nums'>
        {value}
      </p>
    </div>
  )
}
