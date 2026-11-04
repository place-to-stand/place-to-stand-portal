'use client'

import { ExternalLink } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

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
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='text-muted-foreground shrink-0'
          aria-label={`Open ${name}`}
          onClick={onOpen}
        >
          <ExternalLink className='size-3.5' aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Open {entityLabel}</TooltipContent>
    </Tooltip>
  )
}
