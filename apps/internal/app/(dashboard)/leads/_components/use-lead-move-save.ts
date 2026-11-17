'use client'

import { startTransition, useCallback, type RefObject } from 'react'
import { useRouter } from 'next/navigation'

import { toastLink, useToast } from '@/components/ui/use-toast'
import type { LeadStatusValue } from '@/lib/leads/constants'
import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import { undoLeadMoves } from '@/lib/leads/undo-lead-moves'
import { isLatestLeadMove, markLeadMove } from '@/lib/leads/lead-move-tokens'

import { moveLead } from '../actions'

/**
 * Saves one lead's move, already on the board. Moves can overlap (the
 * board doesn't wait for a save), so a failure puts back only this lead,
 * against the board as it is now, and only if it hasn't moved since. The
 * Won billing prompt follows the server: it shows when this save took the
 * lead into Won, unless a later drop has moved the lead since.
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
  const router = useRouter()

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
      const token = markLeadMove(columnsRef, [leadId])
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
            [{ leadId, rank: result.rank }],
            result.targetColumnId
          )
          setColumns(undone)
          columnsRef.current = undone
          // A failed save doesn't refresh the board: ask the server where
          // everything is (shown once the other saves have landed).
          router.refresh()
          toast({
            variant: 'destructive',
            title: 'Unable to move lead',
            description: response.error ?? 'Please try again.',
            link: toastLink('lead', leadId),
          })
        } else if (
          // Just won (the server says this save took it into Won), and not
          // dropped again since: billing is the next step.
          response.won &&
          isLatestLeadMove(columnsRef, leadId, token) &&
          draggedLead &&
          onLeadClosedWon
        ) {
          onLeadClosedWon(draggedLead)
        }
      })
    },
    [columnsRef, onLeadClosedWon, router, setColumns, toast]
  )
}
