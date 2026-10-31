'use client'

import { useMemo, useState, useTransition } from 'react'
import { Archive, MoreHorizontal, Pencil } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { RICH_TEXT_HTML_CLASSES } from '@/components/ui/rich-text-editor/rich-text-html'
import { sanitizeEditorHtml } from '@/components/ui/rich-text-editor/utils'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useToast } from '@/components/ui/use-toast'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { formatCalendarDate } from '@pts/ui/dates'
import {
  LEAD_UPDATE_NOT_AUTHOR_MESSAGE,
  canChangeLeadUpdate,
} from '@/lib/leads/lead-update-access'
import type { LeadUpdateRecord } from '@/lib/leads/types'
import { LEAD_UPDATE_LABELS } from '@/lib/leads/updates'
import { cn } from '@/lib/utils'

import { LeadUpdateTypeBadge } from './lead-update-type-badge'
import { deleteLeadUpdate } from '../../../_actions/updates/delete-lead-update'

type LeadUpdateItemProps = {
  update: LeadUpdateRecord
  canManage: boolean
  onEdit: (update: LeadUpdateRecord) => void
  onArchived: () => void
  className?: string
}

export function LeadUpdateItem({
  update,
  canManage,
  onEdit,
  onArchived,
  className,
}: LeadUpdateItemProps) {
  const { toast } = useToast()
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const label = LEAD_UPDATE_LABELS[update.type]
  const authorDisplay = update.authorName ?? update.authorEmail ?? 'Unknown'
  const occurredLabel = formatCalendarDate(update.occurredAt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const actionsLabel = `Actions for ${label.toLowerCase()} logged ${occurredLabel}`
  // Only the author or an admin may edit or archive it; the server enforces
  // the same rule.
  const { role, userId } = useViewerAccess()
  const canChange = canChangeLeadUpdate({ role, userId }, update.authorId)

  // Same double-sanitize convention as task comments: the dialog sanitizes
  // before send, and the renderer sanitizes again before injecting. Pre-RTE
  // rows hold plain text, which passes through unchanged.
  const sanitizedBody = useMemo(
    () => sanitizeEditorHtml(update.body ?? ''),
    [update.body]
  )

  const handleArchive = () => {
    startTransition(async () => {
      const result = await deleteLeadUpdate({
        id: update.id,
        leadId: update.leadId,
      })

      if (result.success) {
        toast({ title: 'Update archived' })
        onArchived()
        return
      }

      toast({
        variant: 'destructive',
        title: 'Unable to archive update',
        description: result.error ?? 'Please try again.',
      })
    })
  }

  return (
    <div className={cn('bg-muted/30 rounded-lg border p-3', className)}>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          {/* Icon + label + color together — color is never the only signal. */}
          <LeadUpdateTypeBadge type={update.type} />
          <span className='text-muted-foreground text-xs'>{occurredLabel}</span>
        </div>
        {canManage && !canChange ? (
          // Someone else's update: the menu stays put but says why it's off.
          <DisabledFieldTooltip
            disabled
            reason={LEAD_UPDATE_NOT_AUTHOR_MESSAGE}
          >
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className='text-muted-foreground shrink-0'
              disabled
              aria-label={actionsLabel}
            >
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DisabledFieldTooltip>
        ) : canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  className='text-muted-foreground hover:text-foreground shrink-0'
                  disabled={isPending}
                  aria-label={actionsLabel}
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
        className={cn(
          RICH_TEXT_HTML_CLASSES,
          'mt-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0'
        )}
        dangerouslySetInnerHTML={{ __html: sanitizedBody }}
      />
      <div className='text-muted-foreground mt-2 flex items-center gap-1.5 text-xs'>
        <Avatar className='h-4 w-4'>
          {update.authorAvatarUrl ? (
            <AvatarImage
              src={`/api/storage/user-avatar/${update.authorId}`}
              alt={authorDisplay}
            />
          ) : null}
          <AvatarFallback className='text-[8px]'>
            {authorDisplay.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span>{authorDisplay}</span>
      </div>

      <ArchiveConfirmDialog
        open={showArchiveConfirm}
        entity='update'
        name={`the ${label.toLowerCase()} from ${occurredLabel}`}
        list='the timeline'
        onConfirm={() => {
          setShowArchiveConfirm(false)
          handleArchive()
        }}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </div>
  )
}
