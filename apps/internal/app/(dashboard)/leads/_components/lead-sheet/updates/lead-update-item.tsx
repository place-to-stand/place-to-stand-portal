'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCalendarDate } from '@/lib/dates'
import type { LeadUpdateRecord } from '@/lib/leads/types'
import {
  LEAD_UPDATE_ICONS,
  LEAD_UPDATE_LABELS,
  LEAD_UPDATE_TOKENS,
} from '@/lib/leads/updates'
import { cn } from '@/lib/utils'

import { deleteLeadUpdate } from '../../../_actions/updates/delete-lead-update'

type LeadUpdateItemProps = {
  update: LeadUpdateRecord
  canManage: boolean
  onDeleted: () => void
}

export function LeadUpdateItem({
  update,
  canManage,
  onDeleted,
}: LeadUpdateItemProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const Icon = LEAD_UPDATE_ICONS[update.type]
  const label = LEAD_UPDATE_LABELS[update.type]
  const authorDisplay = update.authorName ?? update.authorEmail ?? 'Unknown'
  const occurredLabel = formatCalendarDate(update.occurredAt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className='bg-muted/30 rounded-lg border p-3'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          {/* Icon + label + color together — color is never the only signal. */}
          <Badge
            className={cn('gap-1 text-xs', LEAD_UPDATE_TOKENS[update.type])}
          >
            <Icon className='h-3 w-3' aria-hidden='true' />
            {label}
          </Badge>
          <span className='text-muted-foreground text-xs'>{occurredLabel}</span>
        </div>
        {canManage ? (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-muted-foreground hover:text-destructive h-7 w-7 shrink-0 p-0'
            aria-label={`Delete ${label.toLowerCase()} logged ${occurredLabel}`}
            disabled={isPending}
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const result = await deleteLeadUpdate({
                  id: update.id,
                  leadId: update.leadId,
                })

                if (result.success) {
                  onDeleted()
                  return
                }

                setError(result.error ?? 'Unable to delete update.')
              })
            }}
          >
            <Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
          </Button>
        ) : null}
      </div>
      <p className='mt-2 text-sm whitespace-pre-wrap'>{update.body}</p>
      <p className='text-muted-foreground mt-2 text-xs'>{authorDisplay}</p>
      {error ? (
        <p role='alert' className='text-destructive mt-2 text-xs'>
          {error}
        </p>
      ) : null}
    </div>
  )
}
