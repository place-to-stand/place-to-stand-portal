'use client'

import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { useProjectsBoardSensors } from '@/app/(dashboard)/projects/_hooks/use-projects-board-sensors'
import { useScrollPersistence } from '@/hooks/use-scroll-persistence'
import { useColumnScrollPersistence } from '@/hooks/use-column-scroll-persistence'
import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { EmptyState } from '@pts/ui/empty-state'
import { toastLink, useToast } from '@/components/ui/use-toast'
import { moveLead } from '../actions'
import {
  cloneColumns,
  findLeadById,
  resolveCurrentLocation,
  type DropTarget,
  resolveDropTarget,
  produceLeadReorder,
} from '../_lib/lead-board-reorder'
import { useRecentlyMovedItem } from '@/lib/dnd/use-recently-moved-item'
import {
  LEAD_WON_NEEDS_COMPANY_MESSAGE,
  breaksWonNeedsCompany,
} from '@/lib/leads/won-rule'

import { LeadColumn } from './lead-column'
import { LeadCardPreview } from './lead-card'

type LeadsBoardProps = {
  initialColumns: LeadBoardColumnData[]
  /** Leads a filter hides; ranks are worked out around them too. */
  hiddenLeads?: LeadRecord[]
  canManage: boolean
  onEditLead: (lead: LeadRecord) => void
  onCreateLead?: (status: LeadStatusValue) => void
  onLeadClosedWon?: (lead: LeadRecord) => void
  /** A Won drag refused for want of a company: open the lead to add one. */
  onWonNeedsCompany?: (lead: LeadRecord) => void
  activeLeadId: string | null
}

export function LeadsBoard({
  initialColumns,
  hiddenLeads = NO_LEADS,
  canManage,
  onEditLead,
  onCreateLead,
  onLeadClosedWon,
  onWonNeedsCompany,
  activeLeadId,
}: LeadsBoardProps) {
  const { sensors } = useProjectsBoardSensors()
  const { viewportRef: boardViewportRef, handleScroll: handleBoardScroll } =
    useScrollPersistence({ storageKey: 'leads-board', axis: 'x' })
  const { getColumnRef, getScrollHandler } = useColumnScrollPersistence({
    storageKey: 'leads-board',
    columnIds: initialColumns.map(col => col.id),
  })
  const [columns, setColumns] = useState(() => cloneColumns(initialColumns))
  const columnsRef = useRef(columns)
  const [draggingLead, setDraggingLead] = useState<LeadRecord | null>(null)
  const dropPreviewRef = useRef<DropTarget | null>(null)
  const [dropPreviewValue, setDropPreviewValue] = useState<DropTarget | null>(
    null
  )
  const dropPreview = dropPreviewValue
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const {
    recentlyMovedId: recentlyMovedLeadId,
    setRecentlyMovedId: setRecentlyMovedLeadId,
    scheduleReset: scheduleRecentlyMovedReset,
    clearTimer: clearRecentlyMovedTimer,
  } = useRecentlyMovedItem()
  const lastLeadOverId = useRef<UniqueIdentifier | null>(null)
  const lastColumnOverId = useRef<UniqueIdentifier | null>(null)

  const setDropPreview = useCallback((next: DropTarget | null) => {
    dropPreviewRef.current = next
    setDropPreviewValue(next)
  }, [])

  useEffect(() => {
    columnsRef.current = columns
  }, [columns])

  // Reset board when server data refreshes, using the
  // adjust-state-during-render pattern instead of a resync effect.
  const [prevInitialColumns, setPrevInitialColumns] = useState(initialColumns)
  if (prevInitialColumns !== initialColumns) {
    setPrevInitialColumns(initialColumns)
    setColumns(cloneColumns(initialColumns))
  }

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const leadId = event.active.id?.toString()
      if (!leadId) {
        return
      }

      const lead = findLeadById(columnsRef.current, leadId)
      if (lead) {
        setDraggingLead(lead)
      }

      setDropPreview(null)
      setRecentlyMovedLeadId(null)
      clearRecentlyMovedTimer()
    },
    [clearRecentlyMovedTimer, setDropPreview, setRecentlyMovedLeadId]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const target = resolveDropTarget(event, columnsRef.current)

      const leadId = event.active.id?.toString()
      if (!target || !leadId) {
        setDropPreview(null)
      } else {
        const currentLocation = resolveCurrentLocation(
          leadId,
          columnsRef.current
        )
        const isSameSpot =
          currentLocation &&
          currentLocation.columnId === target.columnId &&
          currentLocation.index === target.index

        setDropPreview(isSameSpot ? null : target)
      }

      if (target) {
        setDraggingLead(prev =>
          prev ? { ...prev, status: target.columnId } : prev
        )
      }
    },
    [setDropPreview]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const leadId = event.active.id?.toString()
      setDraggingLead(null)
      setDropPreview(null)

      if (!leadId) {
        return
      }

      const currentColumns = columnsRef.current
      const target =
        resolveDropTarget(event, currentColumns) ?? dropPreviewRef.current

      if (!target) {
        return
      }

      const result = produceLeadReorder({
        columns: currentColumns,
        leadId,
        targetColumnId: target.columnId,
        targetIndex: target.index,
        hiddenLeads,
      })

      if (!result) {
        return
      }

      // Decision 7: Won needs a company. Leave the card where it was rather
      // than flash it into Won and back; the server enforces it too.
      const draggedLead = findLeadById(result.previousColumns, leadId)
      if (
        canManage &&
        draggedLead &&
        breaksWonNeedsCompany(
          { status: result.targetColumnId, companyId: draggedLead.companyId },
          draggedLead
        )
      ) {
        if (onWonNeedsCompany) {
          onWonNeedsCompany(draggedLead)
        } else {
          toast({
            variant: 'destructive',
            title: 'Unable to move lead',
            description: LEAD_WON_NEEDS_COMPANY_MESSAGE,
            link: toastLink('lead', draggedLead.id),
          })
        }
        return
      }

      setColumns(result.nextColumns)
      setRecentlyMovedLeadId(leadId)
      scheduleRecentlyMovedReset()

      if (!canManage) {
        columnsRef.current = result.nextColumns
        return
      }

      startTransition(async () => {
        const response = await moveLead({
          leadId,
          targetStatus: result.targetColumnId,
          rank: result.rank,
        })

        if (!response.success) {
          setColumns(result.previousColumns)
          columnsRef.current = result.previousColumns
          toast({
            variant: 'destructive',
            title: 'Unable to move lead',
            description: response.error ?? 'Please try again.',
            link: toastLink('lead', leadId),
          })
        } else {
          columnsRef.current = result.nextColumns

          // Just won (not a reorder inside Won): billing is the next step.
          if (
            result.targetColumnId === 'CLOSED_WON' &&
            draggedLead &&
            draggedLead.status !== 'CLOSED_WON' &&
            draggedLead.companyId &&
            onLeadClosedWon
          ) {
            onLeadClosedWon(draggedLead)
          }
        }
      })
    },
    [
      canManage,
      hiddenLeads,
      onLeadClosedWon,
      onWonNeedsCompany,
      scheduleRecentlyMovedReset,
      setDropPreview,
      setRecentlyMovedLeadId,
      startTransition,
      toast,
    ]
  )

  const handleDragCancel = useCallback(() => {
    setDraggingLead(null)
    setDropPreview(null)
  }, [setDropPreview])

  const totalLeads = columns.reduce(
    (sum, column) => sum + column.leads.length,
    0
  )

  type CollisionArgs = Parameters<CollisionDetection>[0]

  const findDroppable = useCallback(
    (
      id: UniqueIdentifier,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => droppableContainers.find(container => container.id === id),
    []
  )

  const prioritizeCollisions = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      if (collisions.length < 2) {
        return collisions
      }

      const leadCollisions = collisions.filter(collision => {
        const container = findDroppable(collision.id, droppableContainers)
        return container?.data?.current?.type === 'lead'
      })

      if (leadCollisions.length > 0) {
        return leadCollisions
      }

      return collisions
    },
    [findDroppable]
  )

  const rememberLeadCollision = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      const first = collisions[0]

      if (!first) {
        return
      }

      const container = findDroppable(first.id, droppableContainers)

      if (container?.data?.current?.type === 'lead') {
        lastLeadOverId.current = first.id
      }
    },
    [findDroppable]
  )

  const rememberColumnCollision = useCallback(
    (
      collisions: ReturnType<typeof pointerWithin>,
      droppableContainers: CollisionArgs['droppableContainers']
    ) => {
      for (const collision of collisions) {
        const container = findDroppable(collision.id, droppableContainers)

        if (container?.data?.current?.type === 'column') {
          lastColumnOverId.current = collision.id
          return
        }
      }
    },
    [findDroppable]
  )

  const fallbackToLastLead = useCallback(
    (droppableContainers: CollisionArgs['droppableContainers']) => {
      if (!lastLeadOverId.current) {
        return null
      }

      const container = findDroppable(
        lastLeadOverId.current,
        droppableContainers
      )

      if (!container) {
        lastLeadOverId.current = null
        return null
      }

      return [{ id: lastLeadOverId.current }]
    },
    [findDroppable]
  )

  const fallbackToLastColumn = useCallback(
    (droppableContainers: CollisionArgs['droppableContainers']) => {
      if (!lastColumnOverId.current) {
        return null
      }

      const container = findDroppable(
        lastColumnOverId.current,
        droppableContainers
      )

      if (!container) {
        lastColumnOverId.current = null
        return null
      }

      return [{ id: lastColumnOverId.current }]
    },
    [findDroppable]
  )

  const collisionDetection = useCallback<CollisionDetection>(
    args => {
      const pointerCollisions = pointerWithin(args)

      if (pointerCollisions.length > 0) {
        const prioritized = prioritizeCollisions(
          pointerCollisions,
          args.droppableContainers
        )

        rememberLeadCollision(prioritized, args.droppableContainers)
        rememberColumnCollision(pointerCollisions, args.droppableContainers)

        return prioritized
      }

      const intersections = rectIntersection(args)

      if (intersections.length > 0) {
        const prioritized = prioritizeCollisions(
          intersections,
          args.droppableContainers
        )

        rememberLeadCollision(prioritized, args.droppableContainers)
        rememberColumnCollision(intersections, args.droppableContainers)

        return prioritized
      }

      const leadFallback = fallbackToLastLead(args.droppableContainers)

      if (leadFallback) {
        return leadFallback
      }

      const columnFallback = fallbackToLastColumn(args.droppableContainers)

      if (columnFallback) {
        return columnFallback
      }

      return closestCenter(args)
    },
    [
      fallbackToLastColumn,
      fallbackToLastLead,
      prioritizeCollisions,
      rememberColumnCollision,
      rememberLeadCollision,
    ]
  )

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      {totalLeads === 0 ? (
        <EmptyState message='No leads yet.' />
      ) : (
        <div className='relative min-h-0 flex-1'>
          <div className='absolute inset-0 overflow-hidden'>
            <div
              ref={boardViewportRef}
              className='h-full min-h-0 overflow-x-auto'
              onScroll={handleBoardScroll}
            >
              <DndContext
                sensors={sensors}
                onDragStart={event => {
                  lastLeadOverId.current = null
                  lastColumnOverId.current = null
                  handleDragStart(event)
                }}
                onDragOver={handleDragOver}
                onDragEnd={event => {
                  lastLeadOverId.current = null
                  lastColumnOverId.current = null
                  handleDragEnd(event)
                }}
                onDragCancel={() => {
                  lastLeadOverId.current = null
                  lastColumnOverId.current = null
                  handleDragCancel()
                }}
                collisionDetection={collisionDetection}
              >
                <div className='flex h-full w-max gap-4 p-1'>
                  {columns.map(column => {
                    const handleCreateForColumn =
                      canManage && onCreateLead
                        ? () => onCreateLead(column.id)
                        : undefined

                    return (
                      <LeadColumn
                        key={column.id}
                        columnId={column.id}
                        label={column.label}
                        leads={column.leads}
                        canManage={canManage && !isPending}
                        enableCreateButton={canManage}
                        onEditLead={onEditLead}
                        onCreateLead={handleCreateForColumn}
                        activeLeadId={activeLeadId}
                        isDropTarget={dropPreview?.columnId === column.id}
                        dropIndicatorIndex={
                          dropPreview?.columnId === column.id
                            ? dropPreview.index
                            : null
                        }
                        draggingLeadId={draggingLead?.id ?? null}
                        recentlyMovedLeadId={recentlyMovedLeadId}
                        columnScrollRef={getColumnRef(column.id)}
                        onColumnScroll={getScrollHandler(column.id)}
                      />
                    )
                  })}
                </div>
                <DragOverlay dropAnimation={null}>
                  {draggingLead ? (
                    <LeadCardPreview lead={draggingLead} />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const NO_LEADS: LeadRecord[] = []
