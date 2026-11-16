'use client'

import {
  useCallback,
  type RefObject,
  type TransitionStartFunction,
} from 'react'

import { toastLink, useToast } from '@/components/ui/use-toast'
import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'
import type { LeadStatusValue } from '@/lib/leads/constants'
import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import {
  LEAD_WON_NEEDS_COMPANY_MESSAGE,
  breaksWonNeedsCompany,
} from '@/lib/leads/won-rule'

import { moveLead } from '../actions'
import { produceLeadGroupMove } from '../_lib/lead-board-reorder'

/**
 * Several selected leads dragged together: they show in their new place at
 * once, each saves through the one-lead move, and all go back if one is
 * refused. Won needs a company, so a group with a lead that has none stays
 * put.
 */
export function useLeadGroupMove({
  columnsRef,
  setColumns,
  hiddenLeads,
  canManage,
  startTransition,
  onMoved,
  onLeadClosedWon,
}: {
  columnsRef: RefObject<LeadBoardColumnData[]>
  setColumns: (columns: LeadBoardColumnData[]) => void
  hiddenLeads: LeadRecord[]
  canManage: boolean
  startTransition: TransitionStartFunction
  /** The dragged lead, for the board's just-moved styling. */
  onMoved: (id: string) => void
  onLeadClosedWon?: (lead: LeadRecord) => void
}) {
  const { toast } = useToast()

  return useCallback(
    (move: KanbanMove<LeadStatusValue> & { group: readonly string[] }) => {
      const result = produceLeadGroupMove({
        columns: columnsRef.current,
        group: move.group,
        targetColumnId: move.to.columnId,
        targetIndex: move.to.index,
        hiddenLeads,
      })
      if (!result) return

      const status = move.to.columnId
      const noCompany = result.moved.find(({ lead }) =>
        breaksWonNeedsCompany({ status, companyId: lead.companyId }, lead)
      )
      if (canManage && noCompany) {
        toast({
          variant: 'destructive',
          title: 'Unable to move leads',
          description: LEAD_WON_NEEDS_COMPANY_MESSAGE,
          link: toastLink('lead', noCompany.lead.id),
        })
        return
      }

      setColumns(result.nextColumns)
      onMoved(move.id)
      if (!canManage) {
        columnsRef.current = result.nextColumns
        return
      }

      startTransition(async () => {
        const responses = await Promise.all(
          result.moved.map(({ lead, rank }) =>
            moveLead({ leadId: lead.id, targetStatus: status, rank })
          )
        )
        const failed = responses.findIndex(response => !response.success)
        if (failed !== -1) {
          // Saved ones come back in the refresh that follows every save.
          setColumns(result.previousColumns)
          columnsRef.current = result.previousColumns
          toast({
            variant: 'destructive',
            title: 'Unable to move leads',
            description: responses[failed]?.error ?? 'Please try again.',
            link: toastLink('lead', result.moved[failed]!.lead.id),
          })
          return
        }
        columnsRef.current = result.nextColumns

        // Just won: billing is the next step, for the first won lead.
        const won = result.moved.find(
          ({ lead }) =>
            status === 'CLOSED_WON' &&
            lead.status !== 'CLOSED_WON' &&
            lead.companyId
        )
        if (won) onLeadClosedWon?.(won.lead)
      })
    },
    [
      canManage,
      columnsRef,
      hiddenLeads,
      onLeadClosedWon,
      onMoved,
      setColumns,
      startTransition,
      toast,
    ]
  )
}
