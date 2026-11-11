import { BOARD_LANE_TINTS, type BadgeTint } from '@pts/ui/badge-tints'

import { cn } from '@/lib/utils'

/**
 * A kanban column is an open lane, not a box. Boards sit inside the page's
 * `PagePanel`, below its filter bar, and each lane carries a 2px line across
 * its top in its status badge's hue. A 1px divider sits halfway into the
 * board's `gap-4` between lanes (the `after:` line, hidden on the last lane).
 * Cards (`card` + border + shadow) sit straight on the panel.
 *
 * A lane never grows past the board: the board's one row is capped at its
 * height (`BOARD_GRID_CLASS`) and the lane clips vertically (`overflow-y-clip`,
 * which unlike `overflow-hidden` leaves the divider outside its right edge
 * visible), so a long lane scrolls inside its own list.
 *
 * While a card is dragged over a lane, the lane takes a faint fill in its own
 * hue. No ring: the fill is enough.
 */
export function boardColumnClass(hue: BadgeTint, isDropTarget: boolean) {
  const tint = BOARD_LANE_TINTS[hue]

  return cn(
    'relative flex min-h-0 min-w-0 flex-col gap-3 overflow-y-clip border-t-2 px-2 py-3 transition',
    "after:bg-border after:absolute after:inset-y-0 after:-right-2 after:w-px after:content-[''] last:after:hidden",
    tint.line,
    isDropTarget && tint.drop
  )
}

/**
 * The grid holding a board's lanes. One row, capped at the board's height
 * (`minmax(0,1fr)`), so the longest lane can't stretch the board and push the
 * lanes' tops out of view.
 */
export const BOARD_GRID_CLASS = 'grid h-full grid-rows-[minmax(0,1fr)] gap-4'

/**
 * The board grid's columns: every lane at least 20rem, sharing any spare
 * width, so the task and lead boards size their lanes the same way (wide
 * screens fill, narrow ones scroll sideways).
 */
export function boardGridStyle(laneCount: number) {
  return {
    gridTemplateColumns: `repeat(${laneCount}, minmax(20rem, 1fr))`,
  }
}

/**
 * The board's `PagePanel`: filter bar on top, the board filling the rest of
 * the viewport (its columns scroll on their own).
 */
export const BOARD_PANEL_CLASS = 'flex min-h-0 flex-1 flex-col gap-4'
