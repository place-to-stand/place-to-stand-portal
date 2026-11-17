'use client'

import { startTransition, useCallback, type RefObject } from 'react'

import { toastLink, useToast } from '@/components/ui/use-toast'
import type { KanbanMove } from '@/lib/dnd/use-kanban-drag'
import type { LeadStatusValue } from '@/lib/leads/constants'
import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import {
  LEAD_WON_NEEDS_COMPANY_MESSAGE,
  breaksWonNeedsCompany,
} from '@/lib/leads/won-rule'
import { LEAD_NOT_FOUND_MESSAGE } from '@/lib/leads/move-messages'

import { moveLeads } from '../actions'
import { isInColumn, produceLeadGroupMove } from '../_lib/lead-board-reorder'
import { undoLeadMoves } from '@/lib/leads/undo-lead-moves'

/**
 * Several selected leads dragged together: they show in their new place at
 * once and save in one request, each as the one-lead move would. When some
 * are refused, the board's refresh after the save shows what really moved
 * (or, when none moved, the leads go back). Won needs a company, so a group
 * with a lead that has none stays put.
 */
export function useLeadGroupMove({
  columnsRef,
  setColumns,
  hiddenLeads,
  canManage,
  onMoved,
  onLeadClosedWon,
}: {
  columnsRef: RefObject<LeadBoardColumnData[]>
  setColumns: (columns: LeadBoardColumnData[]) => void
  hiddenLeads: LeadRecord[]
  canManage: boolean
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

      // The ref, not the board's effect, so a drag right after starts here.
      setColumns(result.nextColumns)
      columnsRef.current = result.nextColumns
      onMoved(move.id)
      if (!canManage) return

      startTransition(async () => {
        const response = await moveLeads({
          moves: result.moved.map(({ lead, rank }) => ({
            leadId: lead.id,
            targetStatus: status,
            rank,
          })),
        }).catch(() => null)
        const failed =
          response?.failed ??
          result.moved.map(({ lead }) => ({
            leadId: lead.id,
            error: 'Please try again.',
          }))
        if (failed.length) {
          // Put back the leads that didn't move. Moves dropped while this
          // one saved stay where they are.
          const undone = undoLeadMoves(
            columnsRef.current,
            result.previousColumns,
            failed.map(({ leadId }) => leadId),
            status
          )
          setColumns(undone)
          columnsRef.current = undone
          const first = failed[0]!
          const name = result.moved.find(({ lead }) => lead.id === first.leadId)
            ?.lead.contactName
          toast({
            variant: 'destructive',
            title:
              failed.length === 1
                ? `Unable to move ${name || 'a lead'}`
                : `Unable to move ${failed.length} leads`,
            description:
              failed.length > 1 && name
                ? `${name}: ${first.error}`
                : first.error,
            // A lead that's gone has nothing to open.
            ...(first.error === LEAD_NOT_FOUND_MESSAGE
              ? {}
              : { link: toastLink('lead', first.leadId) }),
          })
          return
        }
        // Just won: billing is the next step, for the first won lead
        // (unless it has been moved on since).
        const won = result.moved.find(
          ({ lead }) =>
            status === 'CLOSED_WON' &&
            isInColumn(columnsRef.current, 'CLOSED_WON', lead.id) &&
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
      toast,
    ]
  )
}
