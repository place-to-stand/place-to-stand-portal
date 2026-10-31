'use client'

import { useEffect, useRef } from 'react'

/** Room above the heading once it's lined up, matching the sheet's padding. */
const TOP_GAP = 24
/** How long content that grows after opening (the feed loading) is followed. */
const FOLLOW_MS = 1500

/** The closest ancestor that scrolls vertically: the sheet body. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
    node = node.parentElement
  }
  return null
}

/**
 * When something opens (an inline add form, the Activity feed), brings its
 * section up to the top of the sheet once the open animation settles: the
 * heading lands 24px under the top of the sheet body, or the body scrolls as
 * far as it can. Only the sheet body's own scroller moves (never the panel,
 * the dialog or the page), focus stays put, and reduced motion jumps instead
 * of gliding. While the content keeps growing (the feed loading) it lines up
 * again, until the person scrolls themselves.
 */
export function useScrollIntoViewOnOpen<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!open || !element) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cancelled = false
    let container: HTMLElement | null = null

    const align = () => {
      if (cancelled) return
      container = scrollParent(element) ?? container
      if (!container) return
      const offset =
        element.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        TOP_GAP
      const max = container.scrollHeight - container.clientHeight
      const top = Math.min(Math.max(offset, 0), Math.max(max, 0))
      if (Math.abs(container.scrollTop - top) < 1) return
      container.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
    }

    // The person taking over the scroll ends the follow.
    const stop = () => {
      cancelled = true
    }
    const timer = window.setTimeout(align, 220)
    const observer = new ResizeObserver(() => {
      window.setTimeout(align, 50)
    })
    observer.observe(element)
    const endFollow = window.setTimeout(() => observer.disconnect(), FOLLOW_MS)
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchmove', stop, { passive: true })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(endFollow)
      observer.disconnect()
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchmove', stop)
    }
  }, [open])

  return ref
}
