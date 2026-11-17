import type { LeadBoardColumnData } from './types'

/**
 * A lead move whose save failed, taken back on the board as it is now:
 * only those leads return to where they were before that move. Other
 * moves dropped while it was saving stay where they are.
 */
export function undoLeadMoves(
  current: LeadBoardColumnData[],
  before: LeadBoardColumnData[],
  leadIds: readonly string[]
): LeadBoardColumnData[] {
  const undo = new Set(leadIds)
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
