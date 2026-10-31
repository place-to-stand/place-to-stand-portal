'use client'

import { useEffect, useRef } from 'react'

/**
 * When something opens (an inline add form, the Activity feed), brings its
 * section up to the top of the sheet once the open animation settles: the
 * heading lands just under the sheet header (the element's scroll-margin),
 * or the sheet scrolls as far as it can. Scrolls only the sheet's own
 * container, never moves focus, and jumps instead of gliding for reduced
 * motion. `settleMs` lists when to line up again, for content that grows
 * after opening (the feed loading).
 */
export function useScrollIntoViewOnOpen<T extends HTMLElement>(
  open: boolean,
  settleMs: readonly number[] = [220]
) {
  const ref = useRef<T>(null)
  const delays = settleMs.join(',')

  useEffect(() => {
    if (!open) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers = delays.split(',').map(delay =>
      window.setTimeout(() => {
        ref.current?.scrollIntoView({
          block: 'start',
          behavior: reduce ? 'auto' : 'smooth',
        })
      }, Number(delay))
    )
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [open, delays])

  return ref
}
