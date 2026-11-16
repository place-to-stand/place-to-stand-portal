'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Long enough to follow the card, short enough not to wait on it. */
const FLIP_MS = 220

/**
 * Slides cards to their new places after a move that isn't a drag (the card
 * menu's Send to top / bottom). Call the returned `capture` just before the
 * move: it notes where every `[data-flip-id]` card in `container` sits, and
 * once the new order renders each card glides from its old place to its new
 * one. Uses the Web Animations API, so it never touches the inline styles
 * dnd-kit sets. Skipped for people who prefer reduced motion.
 */
export function useFlipOnMove(
  container: RefObject<HTMLElement | null>,
  order: unknown
) {
  const pending = useRef<Map<string, number> | null>(null)

  const capture = () => {
    const node = container.current
    if (!node) return
    const tops = new Map<string, number>()
    node.querySelectorAll<HTMLElement>('[data-flip-id]').forEach(card => {
      tops.set(card.dataset.flipId ?? '', card.getBoundingClientRect().top)
    })
    pending.current = tops
  }

  useLayoutEffect(() => {
    const tops = pending.current
    const node = container.current
    if (!tops || !node) return
    pending.current = null
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    node.querySelectorAll<HTMLElement>('[data-flip-id]').forEach(card => {
      const before = tops.get(card.dataset.flipId ?? '')
      if (before === undefined) return
      const delta = before - card.getBoundingClientRect().top
      if (Math.abs(delta) < 1) return
      card.animate(
        [
          { transform: `translateY(${delta}px)` },
          { transform: 'translateY(0)' },
        ],
        { duration: FLIP_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
      )
    })
  }, [container, order])

  return capture
}
