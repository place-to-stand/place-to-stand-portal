'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  type CollisionDetection,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import {
  DASHBOARD_LAYOUT_COLUMN_COUNT,
  type DashboardLayout,
  type DashboardWidgetId,
} from '@/lib/dashboard/layout'

import { LayoutColumn } from './layout-column'
import { createRestrictToGrid } from './restrict-to-grid'
import { parseColumnDroppableId } from './types'
import type { DashboardWidgetData } from './types'

type DashboardWidgetGridProps = {
  layout: DashboardLayout
  data: DashboardWidgetData
  isEditing: boolean
  onHideWidget: (id: DashboardWidgetId) => void
  onShowWidget: (id: DashboardWidgetId) => void
  onDragStart: (event: DragStartEvent) => void
  onDragOver: (event: DragOverEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragCancel: () => void
}

export function DashboardWidgetGrid({
  layout,
  data,
  isEditing,
  onHideWidget,
  onShowWidget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: DashboardWidgetGridProps) {
  // State (not a ref) so the modifier closure is rebuilt once the grid mounts.
  const [gridElement, setGridElement] = useState<HTMLDivElement | null>(null)
  const modifiers = useMemo(
    () => [createRestrictToGrid(gridElement)],
    [gridElement]
  )
  // The divider decides show vs hide: with the pointer above the line only
  // the dashboard columns are drop targets, below it only the tray. The
  // switch happens the moment the pointer crosses, however far the nearest
  // widget is.
  const dividerRef = useRef<HTMLDivElement | null>(null)
  const collisionDetection = useCallback<CollisionDetection>(args => {
    const line = dividerRef.current?.getBoundingClientRect()
    const pointer = args.pointerCoordinates
    if (!line || !pointer) return closestCorners(args)
    const below = pointer.y > line.top + line.height / 2
    // Classify by list membership (from each droppable's data), not by
    // measured position: rects go stale while items move between lists.
    const droppableContainers = args.droppableContainers.filter(container => {
      const columnIndex =
        parseColumnDroppableId(String(container.id)) ??
        (container.data.current?.columnIndex as number | undefined)
      if (columnIndex === undefined) return false
      return below
        ? columnIndex === DASHBOARD_LAYOUT_COLUMN_COUNT
        : columnIndex < DASHBOARD_LAYOUT_COLUMN_COUNT
    })
    return closestCorners({ ...args, droppableContainers })
  }, [])
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Press-and-hold on touch, so a swipe still scrolls the page.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={modifiers}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {/* Widget gutters match the shell's content padding (p-3 sm:p-4). */}
      {/* One bounding box for the grid and the hidden tray, so widgets can
          be dragged between them. */}
      <div ref={setGridElement}>
        <div className='grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2'>
          {layout.columns.map((widgetIds, columnIndex) => (
            <LayoutColumn
              key={columnIndex}
              columnIndex={columnIndex}
              widgetIds={widgetIds}
              data={data}
              isEditing={isEditing}
              onHideWidget={onHideWidget}
              onShowWidget={onShowWidget}
            />
          ))}
        </div>
        {isEditing ? (
          <section
            className='mt-12 space-y-4'
            aria-labelledby='hidden-widgets-heading'
          >
            {/* The line between showing and hidden: drag a widget above it to
                show it, below it to hide it. */}
            <div ref={dividerRef} className='flex items-center gap-3'>
              <div className='bg-border h-px flex-1' />
              <h2
                id='hidden-widgets-heading'
                className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'
              >
                Hidden widgets
              </h2>
              <div className='bg-border h-px flex-1' />
            </div>
            <p className='text-muted-foreground text-center text-sm'>
              {layout.hidden.length === 0
                ? 'Drag a widget below the line, or use Hide, to take it off your home.'
                : 'Drag a widget above the line, or use Show, to put it on your home.'}
            </p>
            <LayoutColumn
              columnIndex={DASHBOARD_LAYOUT_COLUMN_COUNT}
              widgetIds={layout.hidden}
              data={data}
              isEditing={isEditing}
              isHiddenTray
              onHideWidget={onHideWidget}
              onShowWidget={onShowWidget}
            />
          </section>
        ) : null}
      </div>
    </DndContext>
  )
}
