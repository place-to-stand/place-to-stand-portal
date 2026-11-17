'use client'

import { startTransition, useCallback, type RefObject } from 'react'

import { toastLink, useToast } from '@/components/ui/use-toast'
import type { LeadStatusValue } from '@/lib/leads/constants'
import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import { undoLeadMoves } from '@/lib/leads/undo-lead-moves'

import { moveLead } from '../actions'
import { isInColumn } from '../_lib/lead-board-reorder'

/**
 * Saves one lead's move, already on the board. Moves can overlap (the
 * board doesn't wait for a save), so a failure puts back only this lead,
 * against the board as it is now, and only if it hasn't moved since. The
 * Won billing prompt follows the server: it shows when this save took the
 * lead into Won, unless the lead has moved out of Won since.
 */
export function useLeadMoveSave({
  columnsRef,
  setColumns,
  onLeadClosedWon,
}: {
  columnsRef: RefObject<LeadBoardColumnData[]>
  setColumns: (columns: LeadBoardColumnData[]) => void
  onLeadClosedWon?: (lead: LeadRecord) => void
}) {
  const { toast } = useToast()

  return useCallback(
    (
      result: {
        previousColumns: LeadBoardColumnData[]
        nextColumns: LeadBoardColumnData[]
        rank: string
        targetColumnId: LeadStatusValue
      },
      leadId: string,
      draggedLead: LeadRecord | null
    ) => {
      startTransition(async () => {
        const response = await moveLead({
          leadId,
          targetStatus: result.targetColumnId,
          rank: result.rank,
        }).catch(() => ({ success: false, error: undefined, won: false }))

        if (!response.success) {
          // Moves dropped while this one saved stay where they are.
          const undone = undoLeadMoves(
            columnsRef.current,
            result.previousColumns,
            result.nextColumns,
            [leadId]
          )
          setColumns(undone)
          columnsRef.current = undone
          toast({
            variant: 'destructive',
            title: 'Unable to move lead',
            description: response.error ?? 'Please try again.',
            link: toastLink('lead', leadId),
          })
        } else if (
          // Just won (the server says this save took it into Won), and not
          // since moved out: billing is the next step.
          response.won &&
          isInColumn(columnsRef.current, 'CLOSED_WON', leadId) &&
          draggedLead &&
          onLeadClosedWon
        ) {
          onLeadClosedWon(draggedLead)
        }
      })
    },
    [columnsRef, onLeadClosedWon, setColumns, toast]
  )
}
