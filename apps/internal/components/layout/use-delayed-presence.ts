'use client'

import { useEffect, useRef, useState } from 'react'

/** Loads that end sooner than this never show a spinner. */
export const SHOW_AFTER_MS = 300
/** Once shown, the spinner stays at least this long, so it never blinks. */
export const MIN_VISIBLE_MS = 500
/** Its fade in and out. */
export const FADE_MS = 200

/** `in` while it shows or fades in, `out` while it fades out. */
export type PresencePhase = 'hidden' | 'in' | 'out'

/**
 * When a loading indicator should be on screen for a load that is `active`:
 * only once the load has run `SHOW_AFTER_MS` (a quick filter shows nothing),
 * then for at least `MIN_VISIBLE_MS`, then through a `FADE_MS` fade out. A
 * load that starts again while it fades brings it straight back.
 */
export function useDelayedPresence(active: boolean): PresencePhase {
  const [phase, setPhase] = useState<PresencePhase>('hidden')
  const shownAtRef = useRef(0)

  useEffect(() => {
    if (active) {
      if (phase === 'in') return
      if (phase === 'out') {
        // Back before it faded: show it again at once, with a fresh minimum.
        const timer = setTimeout(() => {
          shownAtRef.current = Date.now()
          setPhase('in')
        }, 0)
        return () => clearTimeout(timer)
      }
      const timer = setTimeout(() => {
        shownAtRef.current = Date.now()
        setPhase('in')
      }, SHOW_AFTER_MS)
      return () => clearTimeout(timer)
    }
    if (phase === 'in') {
      const shownFor = Date.now() - shownAtRef.current
      const timer = setTimeout(
        () => setPhase('out'),
        Math.max(0, MIN_VISIBLE_MS - shownFor)
      )
      return () => clearTimeout(timer)
    }
    if (phase === 'out') {
      const timer = setTimeout(() => setPhase('hidden'), FADE_MS)
      return () => clearTimeout(timer)
    }
  }, [active, phase])

  return phase
}
