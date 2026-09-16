'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import type { DashboardLayout } from '@/lib/dashboard/layout'

import { LayoutColumn } from './layout-column'
import { createRestrictToGrid } from './restrict-to-grid'
import type { DashboardWidgetData } from './types'

type DashboardWidgetGridProps = {
  layout: DashboardLayout
  data: DashboardWidgetData
  isEditing: boolean
  onDragStart: (event: DragStartEvent) => void
  onDragOver: (event: DragOverEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragCancel: () => void
}

export function DashboardWidgetGrid({
  layout,
  data,
  isEditing,
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      modifiers={modifiers}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {/* Widget gutters match the shell's content padding (p-3 sm:p-4). */}
      <div
        ref={setGridElement}
        className='grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2'
      >
        {layout.columns.map((widgetIds, columnIndex) => (
          <LayoutColumn
            key={columnIndex}
            columnIndex={columnIndex}
            widgetIds={widgetIds}
            data={data}
            isEditing={isEditing}
          />
        ))}
      </div>
    </DndContext>
  )
}
