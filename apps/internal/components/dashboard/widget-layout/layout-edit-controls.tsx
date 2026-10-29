'use client'

import { Check, Pencil, RotateCcw } from 'lucide-react'

import { Button } from '@pts/ui/button'

type LayoutEditControlsProps = {
  isEditing: boolean
  canReset: boolean
  onStartEditing: () => void
  onStopEditing: () => void
  onReset: () => void
}

/**
 * The home page's toolbar action (where My Tasks has Create task): Edit
 * widgets to enter edit mode; while
 * editing, Reset and Done. Widgets are hidden and shown from the bar above
 * each card or by dragging them to and from the Hidden widgets tray. Saves are optimistic (revert + toast on failure), so
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
  // Same size and place as My Tasks' "Create task".
  if (!isEditing) {
    return (
      <Button type='button' size='sm' onClick={onStartEditing}>
        <Pencil className='h-4 w-4' aria-hidden />
        Edit widgets
      </Button>
    )
  }

  return (
    <div className='flex items-center gap-2'>
      <span
        role='status'
        className='text-muted-foreground mr-1 hidden text-xs sm:inline'
      >
        Drag widgets to arrange them
      </span>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={!canReset}
        onClick={onReset}
      >
        <RotateCcw className='h-4 w-4' aria-hidden />
        Reset
      </Button>
      <Button type='button' size='sm' onClick={onStopEditing}>
        <Check className='h-4 w-4' aria-hidden />
        Done
      </Button>
    </div>
  )
}
