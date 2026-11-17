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
 * against the board as it is now, and the Won billing prompt skips a lead
 * that has moved on since.
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
        }).catch(() => ({ success: false, error: undefined }))

        if (!response.success) {
          // Moves dropped while this one saved stay where they are.
          const undone = undoLeadMoves(
            columnsRef.current,
            result.previousColumns,
            [leadId],
            result.targetColumnId
          )
          setColumns(undone)
          columnsRef.current = undone
          toast({
            variant: 'destructive',
            title: 'Unable to move lead',
            description: response.error ?? 'Please try again.',
            link: toastLink('lead', leadId),
          })
        } else {
          // Just won (not a reorder inside Won, and not since moved on):
          // billing is the next step.
          if (
            result.targetColumnId === 'CLOSED_WON' &&
            isInColumn(columnsRef.current, 'CLOSED_WON', leadId) &&
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
    [columnsRef, onLeadClosedWon, setColumns, toast]
  )
}
