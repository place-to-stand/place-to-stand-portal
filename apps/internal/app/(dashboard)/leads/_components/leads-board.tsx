'use client'

import { DndContext } from '@dnd-kit/core'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'

import { useProjectsBoardSensors } from '@/app/(dashboard)/projects/_hooks/use-projects-board-sensors'
import { BoardDragOverlay } from '@/components/board/board-drag'
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
  produceLeadReorder,
} from '../_lib/lead-board-reorder'
import { useKanbanDrag, type KanbanDrop } from '@/lib/dnd/use-kanban-drag'
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
  /** Shown when no lead is on the board; defaults to "No leads yet." */
  emptyMessage?: string
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
  emptyMessage = 'No leads yet.',
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
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const {
    recentlyMovedId: recentlyMovedLeadId,
    setRecentlyMovedId: setRecentlyMovedLeadId,
    scheduleReset: scheduleRecentlyMovedReset,
    clearTimer: clearRecentlyMovedTimer,
  } = useRecentlyMovedItem()

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

  const handleDrop = useCallback(
    ({ id: leadId, to: target }: KanbanDrop<LeadStatusValue>) => {
      const result = produceLeadReorder({
        columns: columnsRef.current,
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
      setRecentlyMovedLeadId,
      startTransition,
      toast,
    ]
  )

  const columnIds = useMemo(() => columns.map(column => column.id), [columns])
  const leadsIn = useCallback(
    (columnId: LeadStatusValue) =>
      columns.find(column => column.id === columnId)?.leads ?? NO_LEADS,
    [columns]
  )
  const handleDragStart = useCallback(() => {
    setRecentlyMovedLeadId(null)
    clearRecentlyMovedTimer()
  }, [clearRecentlyMovedTimer, setRecentlyMovedLeadId])

  const drag = useKanbanDrag({
    columns: columnIds,
    items: leadsIn,
    onDragStart: handleDragStart,
    onDrop: handleDrop,
  })
  const draggingLead = drag.activeId
    ? findLeadById(columns, drag.activeId)
    : null

  const totalLeads = columns.reduce(
    (sum, column) => sum + column.leads.length,
    0
  )

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      {totalLeads === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className='relative min-h-0 flex-1'>
          <div className='absolute inset-0 overflow-hidden'>
            <div
              ref={boardViewportRef}
              className='h-full min-h-0 overflow-x-auto'
              onScroll={handleBoardScroll}
            >
              <DndContext sensors={sensors} {...drag.dndContextProps}>
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
                        leads={drag.itemsFor(column.id)}
                        canManage={canManage && !isPending}
                        enableCreateButton={canManage}
                        onEditLead={onEditLead}
                        onCreateLead={handleCreateForColumn}
                        activeLeadId={activeLeadId}
                        isDropTarget={drag.activeColumnId === column.id}
                        recentlyMovedLeadId={recentlyMovedLeadId}
                        columnScrollRef={getColumnRef(column.id)}
                        onColumnScroll={getScrollHandler(column.id)}
                      />
                    )
                  })}
                </div>
                <BoardDragOverlay>
                  {draggingLead ? (
                    <LeadCardPreview lead={draggingLead} />
                  ) : null}
                </BoardDragOverlay>
              </DndContext>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const NO_LEADS: LeadRecord[] = []
