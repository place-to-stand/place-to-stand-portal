'use client'

import { ExternalLink } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { RowActionButton } from '@pts/ui/row-action-button'

/**
 * The button on the right of a link field that opens the linked record
 * (stacked as its sheet). Shared by `EntityLinkPicker` and the task sheet's
 * "Project or lead" field so every linked record opens the same way.
 */
export function OpenRecordButton({
  name,
  entityLabel,
  onOpen,
}: {
  /** The record's name, for the button's accessible label. */
  name: string
  /** Singular noun for the tooltip: "Open lead". */
  entityLabel: string
  onOpen: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <RowActionButton
          type='button'
          variant='outline'
          size='icon'
          tooltip={false}
          className='text-muted-foreground shrink-0'
          label={`Open ${name}`}
          icon={<ExternalLink className='size-3.5' aria-hidden />}
          onClick={onOpen}
        />
      </TooltipTrigger>
      <TooltipContent>Open {entityLabel}</TooltipContent>
    </Tooltip>
  )
}
