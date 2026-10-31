'use client'

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { EmptyState } from '@pts/ui/empty-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
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
  /** The hidden-widgets tray rather than a dashboard column. */
  isHiddenTray?: boolean
  onHideWidget: (id: DashboardWidgetId) => void
  onShowWidget: (id: DashboardWidgetId) => void
}

export function LayoutColumn({
  columnIndex,
  widgetIds,
  data,
  isEditing,
  isHiddenTray = false,
  onHideWidget,
  onShowWidget,
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
      // The tray lays hidden widgets out in a wrapping grid.
      strategy={
        isHiddenTray ? rectSortingStrategy : verticalListSortingStrategy
      }
    >
      <div
        ref={setNodeRef}
        className={cn(
          isHiddenTray
            ? 'grid grid-cols-1 content-start items-start gap-3 sm:gap-4 md:grid-cols-2'
            : 'flex flex-col gap-3 sm:gap-4',
          // Empty columns keep a drop area so a widget can be moved into them.
          isEditing && 'min-h-32 rounded-xl transition-colors',
          isEditing && widgetIds.length === 0 && 'border-2 border-dashed',
          isEditing &&
            isOver &&
            widgetIds.length === 0 &&
            'border-primary/50 bg-primary/5',
          // The tray lights up while a widget is dragged into it.
          isHiddenTray &&
            isOver &&
            'bg-muted/40 ring-primary/30 ring-offset-background ring-2 ring-offset-4'
        )}
      >
        {widgetIds.map(id => (
          <SortableWidget
            key={id}
            id={id}
            label={DASHBOARD_WIDGET_LABELS[id]}
            columnIndex={columnIndex}
            isEditing={isEditing}
            hidden={isHiddenTray}
            onHide={onHideWidget}
            onShow={onShowWidget}
          >
            {/* One widget failing never takes down the rest of the page. */}
            <ErrorBoundary
              scope={`widget:${id}`}
              fallback={
                <EmptyState
                  message={`${DASHBOARD_WIDGET_LABELS[id]} couldn't load. Refresh to try again.`}
                />
              }
            >
              <WidgetRenderer id={id} data={data} />
            </ErrorBoundary>
          </SortableWidget>
        ))}
      </div>
    </SortableContext>
  )
}
