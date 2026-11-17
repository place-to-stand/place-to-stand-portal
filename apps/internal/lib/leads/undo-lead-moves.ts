import type { LeadBoardColumnData } from './types'

/**
 * A lead move whose save failed, taken back on the board as it is now:
 * only those leads return to where they were before that move. Other
 * moves dropped while it was saving stay where they are, and so does a
 * lead moved again since: every move gives a lead a new rank, so a lead
 * counts as this move's only while it is still in `movedTo` with the rank
 * this move gave it. (Back to the very same spot can give the same rank;
 * then that later move's own save puts the board right.)
 */
export function undoLeadMoves(
  current: LeadBoardColumnData[],
  before: LeadBoardColumnData[],
  moved: readonly { leadId: string; rank: string }[],
  movedTo: string
): LeadBoardColumnData[] {
  const placed = new Map(
    current
      .find(column => column.id === movedTo)
      ?.leads.map(lead => [lead.id, lead.rank]) ?? []
  )
  const undo = new Set(
    moved
      .filter(({ leadId, rank }) => placed.get(leadId) === rank)
      .map(({ leadId }) => leadId)
  )
  const next = current.map(column => ({
    ...column,
    leads: column.leads.filter(lead => !undo.has(lead.id)),
  }))
  for (const column of before) {
    column.leads.forEach((lead, index) => {
      if (!undo.has(lead.id)) return
      const target = next.find(item => item.id === column.id)
      if (!target) return
      // Its old neighbour above, if still in this column; else its old index.
      const above = column.leads[index - 1]
      const at = above
        ? target.leads.findIndex(item => item.id === above.id) + 1
        : 0
      target.leads.splice(
        at > 0 ? at : Math.min(index, target.leads.length),
        0,
        { ...lead }
      )
    })
  }
  return next
}
