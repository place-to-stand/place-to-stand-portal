'use client'

import type { MutableRefObject, UIEventHandler } from 'react'
import { Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { cn } from '@/lib/utils'
import type { LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { RowActionButton } from '@pts/ui/row-action-button'

import { LeadStatusBadge } from '@/components/leads/lead-status-badge'

import { LeadCard } from './lead-card'
import {
  BOARD_COLUMN_CLASS,
  BOARD_COLUMN_DROP_CLASS,
} from '@/components/board/board-column'

type LeadColumnProps = {
  columnId: LeadStatusValue
  label: string
  leads: readonly LeadRecord[]
  canManage: boolean
  /** Controls + button visibility independently from canManage (drag permission) */
  enableCreateButton?: boolean
  onEditLead: (lead: LeadRecord) => void
  onCreateLead?: (status: LeadStatusValue) => void
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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        BOARD_COLUMN_CLASS,
        'flex min-h-0 w-80 shrink-0 flex-col gap-3 overflow-hidden p-3 transition',
        isDropTarget && BOARD_COLUMN_DROP_CLASS
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
      <div
        ref={columnScrollRef}
        onScroll={onColumnScroll}
        className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto'
      >
        <SortableContext
          id={columnId}
          items={leads.map(lead => lead.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              columnId={columnId}
              canManage={canManage}
              onEditLead={onEditLead}
              disableDropTransition={lead.id === recentlyMovedLeadId}
              isActive={lead.id === activeLeadId}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
