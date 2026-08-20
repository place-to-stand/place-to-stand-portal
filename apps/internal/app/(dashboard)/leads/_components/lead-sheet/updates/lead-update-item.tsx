'use client'

import { useMemo, useState, useTransition } from 'react'
import { Archive, MoreHorizontal, Pencil } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { sanitizeEditorHtml } from '@/components/ui/rich-text-editor/utils'
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
  onEdit: (update: LeadUpdateRecord) => void
  onArchived: () => void
}

export function LeadUpdateItem({
  update,
  canManage,
  onEdit,
  onArchived,
}: LeadUpdateItemProps) {
  const [error, setError] = useState<string | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const Icon = LEAD_UPDATE_ICONS[update.type]
  const label = LEAD_UPDATE_LABELS[update.type]
  const authorDisplay = update.authorName ?? update.authorEmail ?? 'Unknown'
  const occurredLabel = formatCalendarDate(update.occurredAt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Same double-sanitize convention as task comments: the dialog sanitizes
  // before send, and the renderer sanitizes again before injecting. Pre-RTE
  // rows hold plain text, which passes through unchanged.
  const sanitizedBody = useMemo(
    () => sanitizeEditorHtml(update.body ?? ''),
    [update.body]
  )

  const handleArchive = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteLeadUpdate({
        id: update.id,
        leadId: update.leadId,
      })

      if (result.success) {
        onArchived()
        return
      }

      setError(result.error ?? 'Unable to archive update.')
    })
  }

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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground hover:text-foreground h-7 w-7 shrink-0 p-0'
                  disabled={isPending}
                  aria-label={`Actions for ${label.toLowerCase()} logged ${occurredLabel}`}
                />
              }
            >
              <MoreHorizontal className='h-4 w-4' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-36'>
              <DropdownMenuItem onClick={() => onEdit(update)}>
                <Pencil className='h-3.5 w-3.5' /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setShowArchiveConfirm(true)}
              >
                <Archive className='h-3.5 w-3.5' /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div
        className='text-foreground [&_a]:text-primary [&_code]:bg-muted [&_pre]:bg-muted mt-2 space-y-2 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5'
        dangerouslySetInnerHTML={{ __html: sanitizedBody }}
      />
      <p className='text-muted-foreground mt-2 text-xs'>{authorDisplay}</p>
      {error ? (
        <p role='alert' className='text-destructive mt-2 text-xs'>
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={showArchiveConfirm}
        title='Archive this update?'
        description={`The ${label.toLowerCase()} from ${occurredLabel} will be removed from the timeline.`}
        confirmLabel='Archive'
        confirmVariant='destructive'
        onConfirm={() => {
          setShowArchiveConfirm(false)
          handleArchive()
        }}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </div>
  )
}
