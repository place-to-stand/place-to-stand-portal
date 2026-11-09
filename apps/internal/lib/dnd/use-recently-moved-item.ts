import { useCallback, useEffect, useRef, useState } from 'react'

import { BOARD_DROP_ANIMATION_MS } from './kanban'

/**
 * A dropped card skips its CSS transitions until its preview has finished
 * gliding into place, plus a couple of frames. Ending sooner let the card
 * fade back in from hidden after the preview vanished, which read as a flash.
 */
const RECENTLY_MOVED_MS = BOARD_DROP_ANIMATION_MS + 70

export const useRecentlyMovedItem = () => {
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleReset = useCallback(() => {
    clearTimer()

    timerRef.current = window.setTimeout(() => {
      setRecentlyMovedId(null)
      timerRef.current = null
    }, RECENTLY_MOVED_MS)
  }, [clearTimer])

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return {
    recentlyMovedId,
    setRecentlyMovedId,
    scheduleReset,
    clearTimer,
  }
}
