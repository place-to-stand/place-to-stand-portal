/**
 * The newest move of each lead on a board, so a save's answer can tell
 * whether a later drop has taken the lead since (the board itself can't
 * say: a refresh from an earlier save may have reset it meanwhile). Keyed
 * by any object that lives as long as the board (its columns ref).
 */
const boards = new WeakMap<
  object,
  { moves: number; latest: Map<string, number> }
>()

function boardOf(key: object) {
  let board = boards.get(key)
  if (!board) {
    board = { moves: 0, latest: new Map() }
    boards.set(key, board)
  }
  return board
}

/** Records a drop of these leads; returns its token. */
export function markLeadMove(key: object, leadIds: readonly string[]) {
  const board = boardOf(key)
  const token = ++board.moves
  leadIds.forEach(id => board.latest.set(id, token))
  return token
}

/** Whether the drop with this token is still the lead's newest. */
export function isLatestLeadMove(key: object, leadId: string, token: number) {
  return boardOf(key).latest.get(leadId) === token
}
