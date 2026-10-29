'use client'

import { Eye, Pencil, RotateCcw } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import type { DashboardWidgetId } from '@/lib/dashboard/layout'

import { DASHBOARD_WIDGET_LABELS } from './widget-renderer'

type LayoutEditControlsProps = {
  isEditing: boolean
  canReset: boolean
  /** Widgets the viewer may show but has hidden. */
  hiddenWidgets: readonly DashboardWidgetId[]
  onShowWidget: (id: DashboardWidgetId) => void
  onStartEditing: () => void
  onStopEditing: () => void
  onReset: () => void
}

/**
 * Header-right slot for the home page: pencil to enter edit mode; while
 * editing, a menu to show hidden widgets, Reset and Done. Widgets are hidden
 * from the button on each card. Saves are optimistic (revert + toast on failure), so
 * the buttons deliberately don't reflect the in-flight save: toggling
 * disabled/spinner state on every drop reads as a flicker.
 */
export function LayoutEditControls({
  isEditing,
  canReset,
  hiddenWidgets,
  onShowWidget,
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            disabled={hiddenWidgets.length === 0}
          >
            <Eye aria-hidden />
            Show widget
            {hiddenWidgets.length ? ` (${hiddenWidgets.length})` : ''}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Hidden widgets</DropdownMenuLabel>
          {hiddenWidgets.map(id => (
            <DropdownMenuItem key={id} onClick={() => onShowWidget(id)}>
              {DASHBOARD_WIDGET_LABELS[id]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
