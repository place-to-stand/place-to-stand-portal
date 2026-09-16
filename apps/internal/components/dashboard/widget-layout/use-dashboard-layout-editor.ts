'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import {
  resetDashboardLayout,
  saveDashboardLayout,
} from '@/app/(dashboard)/my/home/_actions/save-dashboard-layout'
import { useToast } from '@/components/ui/use-toast'
import {
  DEFAULT_DASHBOARD_LAYOUT,
  cloneLayout,
  isDefaultDashboardLayout,
  layoutsEqual,
  type DashboardLayout,
  type DashboardWidgetId,
} from '@/lib/dashboard/layout'

import { parseColumnDroppableId } from './types'

type UseDashboardLayoutEditorArgs = {
  initialLayout: DashboardLayout
}

/**
 * Owns the editable layout: edit-mode flag, optimistic drag state, and
 * persistence. Each drop saves immediately (reverting with a toast on
 * failure); "Done" only leaves edit mode.
 */
export function useDashboardLayoutEditor({
  initialLayout,
}: UseDashboardLayoutEditorArgs) {
  const [layout, setLayout] = useState(() => cloneLayout(initialLayout))
  const [isEditing, setIsEditing] = useState(false)
  const [, startTransition] = useTransition()
  const { toast } = useToast()
  // Layout as it was when the current drag started, for revert on failure.
  const dragOriginRef = useRef<DashboardLayout | null>(null)
  // Mirror of `layout` for drag handlers, which fire faster than renders.
  const layoutRef = useRef(layout)
  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const persist = useCallback(
    (next: DashboardLayout, previous: DashboardLayout) => {
      startTransition(async () => {
        const result = await saveDashboardLayout(next)
        if (!result.success) {
          layoutRef.current = previous
          setLayout(previous)
          toast({
            variant: 'destructive',
            title: 'Unable to save layout',
            description: result.error,
          })
        }
      })
    },
    [toast]
  )

  const handleDragStart = useCallback(() => {
    dragOriginRef.current = cloneLayout(layoutRef.current)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as DashboardWidgetId
    const current = layoutRef.current
    const fromColumn = findColumnIndex(current, activeId)
    const toColumn = resolveColumnIndex(current, String(over.id))
    if (fromColumn === null || toColumn === null || fromColumn === toColumn) {
      return
    }

    // Move across columns as soon as the pointer crosses, so the target
    // column's sortable list can animate the gap open.
    const next = cloneLayout(current)
    const source = next.columns[fromColumn]!
    const target = next.columns[toColumn]!
    source.splice(source.indexOf(activeId), 1)
    const overWidgetIndex = target.indexOf(String(over.id) as DashboardWidgetId)
    const insertAt = overWidgetIndex === -1 ? target.length : overWidgetIndex
    target.splice(insertAt, 0, activeId)
    layoutRef.current = next
    setLayout(next)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const origin = dragOriginRef.current ?? cloneLayout(layoutRef.current)
      dragOriginRef.current = null

      const activeId = active.id as DashboardWidgetId
      const current = layoutRef.current
      let next = current

      if (over) {
        const column = findColumnIndex(current, activeId)
        const overColumn = resolveColumnIndex(current, String(over.id))
        if (column !== null && column === overColumn) {
          const items = current.columns[column]!
          const from = items.indexOf(activeId)
          const to = items.indexOf(String(over.id) as DashboardWidgetId)
          if (from !== -1 && to !== -1 && from !== to) {
            next = cloneLayout(current)
            next.columns[column] = arrayMove(items, from, to)
          }
        }
      }

      if (layoutsEqual(next, origin)) {
        if (next !== current) setLayout(next)
        return
      }

      layoutRef.current = next
      setLayout(next)
      persist(next, origin)
    },
    [persist]
  )

  const handleDragCancel = useCallback(() => {
    const origin = dragOriginRef.current
    dragOriginRef.current = null
    if (origin) {
      layoutRef.current = origin
      setLayout(origin)
    }
  }, [])

  const reset = useCallback(() => {
    const previous = cloneLayout(layoutRef.current)
    const next = cloneLayout(DEFAULT_DASHBOARD_LAYOUT)
    layoutRef.current = next
    setLayout(next)
    startTransition(async () => {
      const result = await resetDashboardLayout()
      if (!result.success) {
        layoutRef.current = previous
        setLayout(previous)
        toast({
          variant: 'destructive',
          title: 'Unable to reset layout',
          description: result.error,
        })
      }
    })
  }, [toast])

  return {
    layout,
    isEditing,
    isDefault: isDefaultDashboardLayout(layout),
    startEditing: () => setIsEditing(true),
    stopEditing: () => setIsEditing(false),
    reset,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}

function findColumnIndex(layout: DashboardLayout, id: DashboardWidgetId) {
  const index = layout.columns.findIndex(column => column.includes(id))
  return index === -1 ? null : index
}

/** `over` is either a column droppable or a widget inside one. */
function resolveColumnIndex(layout: DashboardLayout, overId: string) {
  const columnIndex = parseColumnDroppableId(overId)
  if (columnIndex !== null) return columnIndex
  return findColumnIndex(layout, overId as DashboardWidgetId)
}
