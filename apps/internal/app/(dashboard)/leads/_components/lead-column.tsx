'use client'

import { useRef, type MutableRefObject, type UIEventHandler } from 'react'
import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import type { LeadRecord } from '@/lib/leads/types'
import { getLeadStatusHue, type LeadStatusValue } from '@/lib/leads/constants'
import { RowActionButton } from '@pts/ui/row-action-button'

import { LeadStatusBadge } from '@/components/leads/lead-status-badge'

import { boardColumnClass } from '@/components/board/board-column'
import { useBoardSelectionContext } from '@/components/board/board-selection'
import { columnEdgeMoves } from '@/lib/dnd/column-edge-moves'
import { useFlipOnMove } from '@/lib/dnd/use-flip-on-move'
import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'

import { LeadCard } from './lead-card'

type LeadColumnProps = {
  columnId: LeadStatusValue
  label: string
  leads: readonly LeadRecord[]
  canManage: boolean
  /** Controls + button visibility independently from canManage (drag permission) */
  enableCreateButton?: boolean
  onEditLead: (lead: LeadRecord) => void
  onCreateLead?: (status: LeadStatusValue) => void
  /**
   * Saves a move the way the board saves a drop. Adds Send to top and Send
   * to bottom to each card's right-click menu (with `canManage`).
   */
  onMoveLead?: (move: KanbanMove<LeadStatusValue>) => void
  /** The dragged card is in this column now. */
  isDropTarget?: boolean
  recentlyMovedLeadId?: string | null
  activeLeadId?: string | null
  columnScrollRef?: MutableRefObject<HTMLDivElement | null>
  onColumnScroll?: UIEventHandler<HTMLDivElement>
}

export function LeadColumn({
  columnId,
  label,
  leads,
  canManage,
  enableCreateButton,
  onEditLead,
  onCreateLead,
  onMoveLead,
  isDropTarget = false,
  recentlyMovedLeadId = null,
  activeLeadId = null,
  columnScrollRef,
  onColumnScroll,
}: LeadColumnProps) {
  const { setNodeRef } = useDroppable({
    id: columnId,
    data: {
      type: 'column',
      columnId,
    },
  })
  const columnRef = useRef<HTMLDivElement | null>(null)
  const selection = useBoardSelectionContext()
  // Send to top / bottom slides the cards, as a drag would show the move.
  const captureFlip = useFlipOnMove(columnRef, leads)
  const moveLead = onMoveLead
    ? (move: KanbanMove<LeadStatusValue>) => {
        captureFlip()
        onMoveLead(move)
      }
    : undefined
  const leadIds = leads.map(lead => lead.id)

  return (
    <div
      ref={node => {
        setNodeRef(node)
        columnRef.current = node
      }}
      data-board-column={columnId}
      className={boardColumnClass(
        getLeadStatusHue(columnId) ?? 'neutral',
        isDropTarget
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-3'>
          <LeadStatusBadge status={columnId} label={label} />
          <span className='text-muted-foreground text-micro font-semibold tabular-nums'>
            {leads.length}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          {(enableCreateButton ?? canManage) && onCreateLead ? (
            <RowActionButton
              type='button'
              label={`Create lead to ${label}`}
              icon={<Plus />}
              onClick={() => onCreateLead(columnId)}
            />
          ) : null}
        </div>
      </div>
      {/* No scroll anchoring: when a card sent to the top or bottom from its
          menu was the column's scroll anchor, the browser would scroll the
          column after it. */}
      <div
        ref={columnScrollRef}
        onScroll={onColumnScroll}
        className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [overflow-anchor:none]'
      >
        <SortableContext
          id={columnId}
          items={leadIds}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead, index) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              columnId={columnId}
              canManage={canManage}
              onEditLead={onEditLead}
              disableDropTransition={lead.id === recentlyMovedLeadId}
              isActive={lead.id === activeLeadId}
              move={
                canManage && moveLead
                  ? columnEdgeMoves(
                      columnId,
                      leadIds,
                      index,
                      moveLead,
                      selection?.columnGroup(lead.id) ?? null
                    )
                  : undefined
              }
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
