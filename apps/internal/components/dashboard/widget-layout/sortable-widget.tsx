'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DashboardWidgetId } from '@/lib/dashboard/layout'

type SortableWidgetProps = {
  id: DashboardWidgetId
  label: string
  columnIndex: number
  isEditing: boolean
  children: ReactNode
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
          'ring-offset-background rounded-xl ring-2 ring-red-400/70 ring-offset-2',
        isDragging && 'z-10 opacity-80 shadow-lg'
      )}
    >
      {children}
      {isEditing ? (
        <div
          aria-label={`Move ${label}`}
          className={cn(
            'group/drag focus-visible:ring-ring absolute inset-0 z-20 rounded-xl outline-none select-none focus-visible:ring-2',
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
