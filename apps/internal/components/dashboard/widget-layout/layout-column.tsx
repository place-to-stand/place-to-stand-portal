'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { cn } from '@/lib/utils'
import type { DashboardWidgetId } from '@/lib/dashboard/layout'

import { SortableWidget } from './sortable-widget'
import { columnDroppableId, type DashboardWidgetData } from './types'
import { DASHBOARD_WIDGET_LABELS, WidgetRenderer } from './widget-renderer'

type LayoutColumnProps = {
  columnIndex: number
  widgetIds: DashboardWidgetId[]
  data: DashboardWidgetData
  isEditing: boolean
}

export function LayoutColumn({
  columnIndex,
  widgetIds,
  data,
  isEditing,
}: LayoutColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(columnIndex),
    data: { type: 'column', columnIndex },
    disabled: !isEditing,
  })

  return (
    <SortableContext
      id={columnDroppableId(columnIndex)}
      items={widgetIds}
      strategy={verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-3 sm:gap-4',
          // Empty columns keep a drop area so a widget can be moved into them.
          isEditing && 'min-h-32 rounded-xl transition-colors',
          isEditing && widgetIds.length === 0 && 'border-2 border-dashed',
          isEditing && isOver && widgetIds.length === 0 && 'border-primary/50 bg-primary/5'
        )}
      >
        {widgetIds.map(id => (
          <SortableWidget
            key={id}
            id={id}
            label={DASHBOARD_WIDGET_LABELS[id]}
            columnIndex={columnIndex}
            isEditing={isEditing}
          >
            <WidgetRenderer id={id} data={data} />
          </SortableWidget>
        ))}
      </div>
    </SortableContext>
  )
}
