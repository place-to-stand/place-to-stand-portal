import { BOARD_DROP_ANIMATION_MS } from './kanban'

/** A group lands at the single drop's pace, one card a beat after another. */
const SETTLE_MS = BOARD_DROP_ANIMATION_MS + 30
const STAGGER_MS = 25
const EASING = 'ease-out'
/** The stack's offset behind the dragged card (`BoardDragOverlay`). */
const STACK_OFFSET_PX = 8

type Rect = { top: number; left: number }

export function findBoardCard(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(
    `[data-board-card="${CSS.escape(id)}"]`
  )
}

/**
 * The height the group takes once dropped: its cards and the gaps between
 * them, as the board lays out one column.
 */
export function groupSlotHeight(group: readonly string[]): number {
  let height = 0
  let gap = 0
  for (const id of group) {
    const card = findBoardCard(id)
    if (!card) continue
    height += card.getBoundingClientRect().height
    if (!gap && card.parentElement) {
      gap = parseFloat(getComputedStyle(card.parentElement).rowGap) || 0
    }
  }
  return height + gap * Math.max(group.length - 1, 0)
}

/** Where every board card is on screen now. */
export function measureBoardCards(): Map<string, Rect> {
  const rects = new Map<string, Rect>()
  if (typeof document === 'undefined') return rects
  for (const card of document.querySelectorAll<HTMLElement>(
    '[data-board-card]'
  )) {
    const { top, left } = card.getBoundingClientRect()
    rects.set(card.dataset.boardCard!, { top, left })
  }
  return rects
}

/**
 * A group drop has no overlay glide: the stack vanishes and the board
 * re-renders with every card of the group in its slot. On the next frame
 * (laid out, not yet painted) each one glides there from the stack, the
 * grabbed card from the top of it and the others fading in from behind, a
 * beat apart in board order. Any other card the drop shifted glides from
 * where it was.
 */
export function settleGroupDrop({
  before,
  stack,
  dragged,
  group,
}: {
  before: Map<string, Rect>
  /** The stack's top-left on screen when it was dropped. */
  stack: Rect | null
  dragged: string
  /** The group, in board order. */
  group: readonly string[]
}) {
  if (
    typeof window === 'undefined' ||
    !stack ||
    typeof Element.prototype.animate !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }
  const order = new Map(group.map((id, index) => [id, index]))
  requestAnimationFrame(() => {
    let behind = 0
    for (const card of document.querySelectorAll<HTMLElement>(
      '[data-board-card]'
    )) {
      const id = card.dataset.boardCard!
      const now = card.getBoundingClientRect()
      const place = order.get(id)
      if (place !== undefined) {
        const grabbed = id === dragged
        const offset = grabbed ? 0 : Math.min(++behind, 2) * STACK_OFFSET_PX
        const dx = stack.left + offset - now.left
        const dy = stack.top + offset - now.top
        card.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px)`,
              opacity: grabbed ? 1 : 0,
              zIndex: grabbed ? 2 : 1,
            },
            { transform: 'none', opacity: 1, zIndex: grabbed ? 2 : 1 },
          ],
          {
            duration: SETTLE_MS,
            delay: place * STAGGER_MS,
            easing: EASING,
            fill: 'backwards',
          }
        )
        continue
      }
      const was = before.get(id)
      if (!was) continue
      const dx = was.left - now.left
      const dy = was.top - now.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      card.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: SETTLE_MS, easing: EASING }
      )
    }
  })
}
