'use client'

import { Pencil, RotateCcw } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

type LayoutEditControlsProps = {
  isEditing: boolean
  canReset: boolean
  onStartEditing: () => void
  onStopEditing: () => void
  onReset: () => void
}

/**
 * Header-right slot for the home page: pencil to enter edit mode, Reset +
 * Done while editing. Saves are optimistic (revert + toast on failure), so
 * the buttons deliberately don't reflect the in-flight save: toggling
 * disabled/spinner state on every drop reads as a flicker.
 */
export function LayoutEditControls({
  isEditing,
  canReset,
  onStartEditing,
  onStopEditing,
  onReset,
}: LayoutEditControlsProps) {
  if (!isEditing) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='Edit widget layout'
            onClick={onStartEditing}
          >
            <Pencil aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit widget layout</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className='flex items-center gap-1.5'>
      <span
        role='status'
        className='text-muted-foreground mr-1.5 hidden text-xs sm:inline'
      >
        Editing widget layout
      </span>
      <Button
        type='button'
        variant='ghost'
        size='xs'
        disabled={!canReset}
        onClick={onReset}
      >
        <RotateCcw aria-hidden />
        Reset
      </Button>
      <Button
        type='button'
        size='xs'
        onClick={onStopEditing}
        aria-label='Done editing layout'
      >
        Done
      </Button>
    </div>
  )
}
