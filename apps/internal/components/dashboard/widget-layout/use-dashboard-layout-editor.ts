'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import {
  resetDashboardLayout,
  saveDashboardLayout,
} from '@/app/(dashboard)/my/home/_actions/save-dashboard-layout'
import { useToast } from '@/components/ui/use-toast'
import type { Role } from '@/lib/auth/capabilities'
import {
  DASHBOARD_LAYOUT_COLUMN_COUNT,
  cloneLayout,
  defaultLayoutForRole,
  hideWidget,
  isDefaultDashboardLayout,
  layoutsEqual,
  showWidget,
  type DashboardLayout,
  type DashboardWidgetId,
} from '@/lib/dashboard/layout'

import { parseColumnDroppableId } from './types'

type UseDashboardLayoutEditorArgs = {
  initialLayout: DashboardLayout
  role: Role
}

/**
 * Owns the editable layout: edit-mode flag, optimistic drag state, and
 * persistence. Each drop saves immediately (reverting with a toast on
 * failure); "Done" only leaves edit mode.
 */
export function useDashboardLayoutEditor({
  initialLayout,
  role,
}: UseDashboardLayoutEditorArgs) {
  const router = useRouter()
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
    (
      next: DashboardLayout,
      previous: DashboardLayout,
      options: { refresh?: boolean } = {}
    ) => {
      startTransition(async () => {
        const result = await saveDashboardLayout(next)
        if (result.success) {
          // A newly shown widget needs its server data.
          if (options.refresh) router.refresh()
        } else {
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
    [router, toast]
  )

  const hide = useCallback(
    (id: DashboardWidgetId) => {
      const previous = cloneLayout(layoutRef.current)
      const next = hideWidget(previous, id)
      layoutRef.current = next
      setLayout(next)
      persist(next, previous)
    },
    [persist]
  )

  const show = useCallback(
    (id: DashboardWidgetId) => {
      const previous = cloneLayout(layoutRef.current)
      const next = showWidget(previous, id)
      layoutRef.current = next
      setLayout(next)
      persist(next, previous, { refresh: true })
    },
    [persist]
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

    // Move across lists (columns or the hidden tray) as soon as the pointer
    // crosses, so the target list can animate the gap open.
    const next = cloneLayout(current)
    const lists = layoutLists(next)
    const source = lists[fromColumn]!
    const target = lists[toColumn]!
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
          const items = layoutLists(current)[column]!
          const from = items.indexOf(activeId)
          const to = items.indexOf(String(over.id) as DashboardWidgetId)
          if (from !== -1 && to !== -1 && from !== to) {
            next = cloneLayout(current)
            const moved = arrayMove(items, from, to)
            if (column === HIDDEN_LIST_INDEX) next.hidden = moved
            else next.columns[column] = moved
          }
        }
      }

      if (layoutsEqual(next, origin)) {
        if (next !== current) setLayout(next)
        return
      }

      layoutRef.current = next
      setLayout(next)
      // A widget dragged out of the hidden tray needs its server data.
      const shown = origin.hidden.some(id => !next.hidden.includes(id))
      persist(next, origin, { refresh: shown })
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
    const next = defaultLayoutForRole(role)
    layoutRef.current = next
    setLayout(next)
    startTransition(async () => {
      const result = await resetDashboardLayout()
      if (result.success) {
        router.refresh()
      } else {
        layoutRef.current = previous
        setLayout(previous)
        toast({
          variant: 'destructive',
          title: 'Unable to reset layout',
          description: result.error,
        })
      }
    })
  }, [role, router, toast])

  return {
    layout,
    isEditing,
    isDefault: isDefaultDashboardLayout(layout, role),
    hide,
    show,
    startEditing: () => setIsEditing(true),
    stopEditing: () => setIsEditing(false),
    reset,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}

/** The hidden tray is the list after the columns. */
export const HIDDEN_LIST_INDEX = DASHBOARD_LAYOUT_COLUMN_COUNT

/** Columns, then the hidden tray, as mutable lists of the given layout. */
function layoutLists(layout: DashboardLayout): DashboardWidgetId[][] {
  return [...layout.columns, layout.hidden]
}

function findColumnIndex(layout: DashboardLayout, id: DashboardWidgetId) {
  const index = layoutLists(layout).findIndex(list => list.includes(id))
  return index === -1 ? null : index
}

/** `over` is either a column droppable or a widget inside one. */
function resolveColumnIndex(layout: DashboardLayout, overId: string) {
  const columnIndex = parseColumnDroppableId(overId)
  if (columnIndex !== null) return columnIndex
  return findColumnIndex(layout, overId as DashboardWidgetId)
}
