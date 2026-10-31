'use client'

import { useEffect } from 'react'

/** How long a deep link keeps its section in view while the sheet loads. */
const SETTLE_MS = 1500

/**
 * Scrolls the sheet to a section (a deep link such as `?tab=billing`). The
 * sections above it load after the sheet opens and push it down, so it is
 * kept in view until they settle, or until the person scrolls or types.
 */
export function useScrollToSection(sectionId: string | null) {
  useEffect(() => {
    if (!sectionId) return
    let done = false
    const scroll = () => {
      if (done) return
      document.getElementById(sectionId)?.scrollIntoView({ block: 'start' })
    }
    scroll()
    const interval = window.setInterval(scroll, 100)
    const stop = () => {
      done = true
      window.clearInterval(interval)
    }
    const timeout = window.setTimeout(stop, SETTLE_MS)
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    events.forEach(event =>
      window.addEventListener(event, stop, { passive: true, capture: true })
    )
    return () => {
      stop()
      window.clearTimeout(timeout)
      events.forEach(event =>
        window.removeEventListener(event, stop, { capture: true })
      )
    }
  }, [sectionId])
}
