'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquareText, Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Skeleton } from '@pts/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatCalendarDate } from '@/lib/dates'
import type { LeadRecord, LeadUpdateRecord } from '@/lib/leads/types'
import {
  LEAD_TOUCH_TYPES,
  daysSinceTouch,
  resolveStaleAfterDays,
  type LeadStaleThresholdSource,
} from '@/lib/leads/updates'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

import { LeadUpdateComposer } from './lead-update-composer'
import { LeadUpdateItem } from './lead-update-item'

type LeadUpdatesSectionProps = {
  lead: LeadRecord
  canManage: boolean
  onSuccess?: () => void
  /** Configured thresholds, for the D24 follow-up due-date prefill. */
  thresholds?: LeadStaleThresholdSource
}

const TOUCH_TYPES = new Set<string>(LEAD_TOUCH_TYPES)

export function LeadUpdatesSection({
  lead,
  canManage,
  onSuccess,
  thresholds = {},
}: LeadUpdatesSectionProps) {
  const { openNew } = useSheetParams()
  const [updates, setUpdates] = useState<LeadUpdateRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isComposing, setIsComposing] = useState(false)

  const fetchUpdates = useCallback(() => {
    // Promise-chained (not awaited inline) so every setState runs
    // asynchronously, even when this is called straight from an effect.
    return fetch(`/api/leads/${lead.id}/updates`)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }
        const data = await response.json()
        setUpdates(data.updates ?? [])
        setLoadFailed(false)
      })
      .catch(error => {
        // Unlike the neighbouring tasks section, a failure here is surfaced:
        // a silent console.error leaves an empty list that reads exactly like
        // "nothing logged yet", which is the opposite of the truth.
        console.error('Failed to fetch lead updates:', error)
        setLoadFailed(true)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [lead.id])

  useEffect(() => {
    fetchUpdates()
  }, [fetchUpdates])

  // Last touch is derived here the same way the server derives it: NOTE never
  // counts (C5). The list is already ordered newest-first.
  const lastTouch = useMemo(
    () => updates.find(update => TOUCH_TYPES.has(update.type)) ?? null,
    [updates]
  )

  const staleAfterDays = resolveStaleAfterDays(lead.status, thresholds)

  const handleSaved = useCallback(
    ({
      addFollowUpTask,
      dueOn,
    }: {
      addFollowUpTask: boolean
      dueOn: string | null
    }) => {
      setIsComposing(false)
      void fetchUpdates()
      onSuccess?.()

      if (addFollowUpTask) {
        // Workflow shortcut only — no schema link between an update and a task.
        openNew('task', dueOn ? { taskDueOn: dueOn } : undefined)
      }
    },
    [fetchUpdates, onSuccess, openNew]
  )

  const summary = (() => {
    if (isLoading) {
      return null
    }

    if (!lastTouch) {
      return 'No touches logged'
    }

    const days = daysSinceTouch(lastTouch.occurredAt, lead.createdAt)
    const absolute = formatCalendarDate(lastTouch.occurredAt)

    return days === 0
      ? `Last touched today (${absolute})`
      : `Last touched ${days} ${days === 1 ? 'day' : 'days'} ago`
  })()

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <MessageSquareText className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Updates</span>
          {updates.length > 0 && (
            <Badge variant='secondary' className='text-xs'>
              {updates.length}
            </Badge>
          )}
        </div>
        {canManage && !isComposing && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setIsComposing(true)}
          >
            <Plus className='mr-1 h-3 w-3' />
            Log update
          </Button>
        )}
      </div>

      {summary ? (
        <p
          className='text-muted-foreground text-xs'
          title={
            lastTouch
              ? (formatCalendarDate(lastTouch.occurredAt) ?? undefined)
              : undefined
          }
        >
          {summary}
        </p>
      ) : null}

      {isComposing ? (
        <LeadUpdateComposer
          leadId={lead.id}
          staleAfterDays={staleAfterDays}
          onCancel={() => setIsComposing(false)}
          onSaved={handleSaved}
        />
      ) : null}

      {isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-16 w-full' />
        </div>
      ) : loadFailed ? (
        <div className='space-y-2 rounded-lg border border-dashed p-3'>
          <p className='text-muted-foreground text-sm'>
            Couldn&apos;t load updates.
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => {
              setIsLoading(true)
              setLoadFailed(false)
              void fetchUpdates()
            }}
          >
            Retry
          </Button>
        </div>
      ) : updates.length === 0 ? (
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm'>
            No interactions logged yet. Notes don&apos;t count toward follow-up.
          </p>
          {canManage && !isComposing ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setIsComposing(true)}
            >
              <Plus className='mr-1 h-3 w-3' />
              Log the first update
            </Button>
          ) : null}
        </div>
      ) : (
        <div className='space-y-2'>
          {updates.map(update => (
            <LeadUpdateItem
              key={update.id}
              update={update}
              canManage={canManage}
              onDeleted={() => {
                void fetchUpdates()
                onSuccess?.()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
