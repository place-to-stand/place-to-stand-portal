import { BOARD_LANE_TINTS, type BadgeTint } from '@pts/ui/badge-tints'

import { cn } from '@/lib/utils'

/**
 * A kanban column is an open lane, not a box. Boards sit inside the page's
 * `PagePanel`, below its filter bar, and each lane carries a 2px line across
 * its top in its status badge's hue. A 1px divider sits halfway into the
 * board's `gap-4` between lanes (the `after:` line, hidden on the last lane).
 * Cards (`card` + border + shadow) sit straight on the panel.
 *
 * While a card is dragged over a lane, the lane takes a faint fill in its own
 * hue. No ring: the fill is enough.
 */
export function boardColumnClass(hue: BadgeTint, isDropTarget: boolean) {
  const tint = BOARD_LANE_TINTS[hue]

  return cn(
    'relative flex min-h-0 min-w-0 flex-col gap-3 border-t-2 px-2 py-3 transition',
    "after:bg-border after:absolute after:inset-y-0 after:-right-2 after:w-px after:content-[''] last:after:hidden",
    tint.line,
    isDropTarget && tint.drop
  )
}

/**
 * The board's `PagePanel`: filter bar on top, the board filling the rest of
 * the viewport (its columns scroll on their own).
 */
export const BOARD_PANEL_CLASS = 'flex min-h-0 flex-1 flex-col gap-4'
