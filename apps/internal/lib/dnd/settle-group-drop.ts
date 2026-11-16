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

/** How long the group takes to gather under the pointer on pick-up. */
const GATHER_MS = BOARD_DROP_ANIMATION_MS + 60

/**
 * Pick-up of a group: call just before the group's other cards leave the
 * board. Each flies from its slot to the stack under the pointer (a copy,
 * since the card itself is gone) and fades into it, a beat apart, and the
 * cards they leave behind close the gap gently. Returns a cancel for a drag
 * that ends first.
 */
export function gatherGroup({
  along,
}: {
  /** The group's other cards, in board order. */
  along: readonly string[]
}): () => void {
  if (
    typeof window === 'undefined' ||
    typeof Element.prototype.animate !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return () => {}
  }
  const before = measureBoardCards()
  const leaving = new Set(along)
  const copies = along.flatMap((id, index) => {
    const card = findBoardCard(id)
    if (!card) return []
    const rect = card.getBoundingClientRect()
    const copy = card.cloneNode(true) as HTMLElement
    copy.removeAttribute('data-board-card')
    copy.removeAttribute('id')
    copy.setAttribute('aria-hidden', 'true')
    Object.assign(copy.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      transform: 'none',
      transition: 'none',
      pointerEvents: 'none',
      zIndex: '998',
    })
    document.body.appendChild(copy)
    return [{ copy, rect, offset: Math.min(index + 1, 2) * STACK_OFFSET_PX }]
  })

  let frame = requestAnimationFrame(function first() {
    // The gap the cards left: everything that moved glides from its old spot.
    for (const card of document.querySelectorAll<HTMLElement>(
      '[data-board-card]'
    )) {
      const id = card.dataset.boardCard!
      if (leaving.has(id)) continue
      const was = before.get(id)
      if (!was) continue
      const now = card.getBoundingClientRect()
      const dx = was.left - now.left
      const dy = was.top - now.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      card.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: GATHER_MS, easing: EASING }
      )
    }

    // The copies chase the stack, which follows the pointer.
    const start = performance.now()
    frame = requestAnimationFrame(function fly(time) {
      const stack = document
        .querySelector('[data-board-dragging]')
        ?.getBoundingClientRect()
      let flying = false
      copies.forEach(({ copy, rect, offset }, index) => {
        const t = Math.min(
          Math.max((time - start - index * STAGGER_MS) / GATHER_MS, 0),
          1
        )
        if (t < 1) flying = true
        const eased = 1 - (1 - t) ** 3
        const toLeft = stack ? stack.left + offset : rect.left
        const toTop = stack ? stack.top + offset : rect.top
        copy.style.transform = `translate(${(toLeft - rect.left) * eased}px, ${(toTop - rect.top) * eased}px)`
        copy.style.opacity = String(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4)
      })
      if (flying) frame = requestAnimationFrame(fly)
      else cleanup()
    })
  })

  function cleanup() {
    cancelAnimationFrame(frame)
    for (const { copy } of copies) copy.remove()
  }
  return cleanup
}
