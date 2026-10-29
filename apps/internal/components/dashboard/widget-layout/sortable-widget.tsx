'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical } from 'lucide-react'

import { Button } from '@pts/ui/button'

import { cn } from '@/lib/utils'
import type { DashboardWidgetId } from '@/lib/dashboard/layout'

type SortableWidgetProps = {
  id: DashboardWidgetId
  label: string
  columnIndex: number
  isEditing: boolean
  /** In the hidden tray: the full widget, dimmed, with a Show button. */
  hidden?: boolean
  onHide: (id: DashboardWidgetId) => void
  onShow: (id: DashboardWidgetId) => void
  children?: ReactNode
}

/**
 * Wraps a widget so it can be reordered in edit mode. Outside edit mode it
 * renders the child untouched; in edit mode the whole card becomes the drag
 * handle (a transparent layer captures the pointer so widget controls can't
 * steal the press) and the card gets a red editing outline. The layer is
 * also the keyboard-focusable activator.
 */
export function SortableWidget({
  id,
  label,
  columnIndex,
  isEditing,
  hidden = false,
  onHide,
  onShow,
  children,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: 'widget', columnIndex },
    disabled: !isEditing,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isEditing &&
          !hidden &&
          'ring-offset-background ring-destructive/70 rounded-xl ring-2 ring-offset-2',
        hidden &&
          'outline-border rounded-xl outline-2 outline-offset-2 outline-dashed',
        isDragging && 'z-10 opacity-80 shadow-lg'
      )}
    >
      {isEditing ? (
        // Edit controls sit in their own bar above the card, so they never
        // cover the widget's header.
        <div className='mb-1.5 flex items-center justify-between gap-2 px-1'>
          <span className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs font-medium'>
            <GripVertical className='size-3.5 shrink-0' aria-hidden />
            <span className='truncate'>{label}</span>
          </span>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            className='relative z-30'
            onClick={() => (hidden ? onShow(id) : onHide(id))}
            aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
          >
            {hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
            {hidden ? 'Show' : 'Hide'}
          </Button>
        </div>
      ) : null}
      {hidden ? (
        // Full widget so you can see what it shows before adding it, dimmed
        // so it still reads as hidden.
        <div className='opacity-50 grayscale'>{children}</div>
      ) : (
        children
      )}
      {isEditing ? (
        <div
          aria-label={`Move ${label}`}
          className={cn(
            'group/drag focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-0 z-20 rounded-xl outline-none select-none focus-visible:ring-[3px]',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
          {...attributes}
          {...listeners}
        >
          {/* Hover/focus/drag hint: a subtle scrim with a centered grip. */}
          <div
            aria-hidden
            className={cn(
              'bg-background/30 pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl opacity-0 transition-opacity',
              'group-hover/drag:opacity-100 group-focus-visible/drag:opacity-100',
              isDragging && 'opacity-100'
            )}
          >
            <span className='bg-card text-muted-foreground flex size-10 items-center justify-center rounded-full border shadow-sm'>
              <GripVertical className='size-5' />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
