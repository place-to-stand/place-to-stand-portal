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

import { moveLeads } from '../actions'
import { produceLeadGroupMove } from '../_lib/lead-board-reorder'

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
          // None moved: put them back. Some moved: the refresh that follows
          // a save shows the board as saved.
          if (failed.length === result.moved.length) {
            setColumns(result.previousColumns)
            columnsRef.current = result.previousColumns
          }
          toast({
            variant: 'destructive',
            title:
              failed.length === 1
                ? 'Unable to move a lead'
                : `Unable to move ${failed.length} leads`,
            description: failed[0]!.error,
            link: toastLink('lead', failed[0]!.leadId),
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
