'use client'

import { useEffect } from 'react'

type UseRecordCycleOptions = {
  onPrevious: () => void
  onNext: () => void
  canPrevious: boolean
  canNext: boolean
}

/**
 * `⌘[` / `⌘]` (or Ctrl) prev/next-record navigation (PRD 004 §01, D14).
 * Extracted verbatim from the retired combobox header components so the
 * muscle-memory shortcut survives the header redesign.
 */
export function useRecordCycle({
  onPrevious,
  onNext,
  canPrevious,
  canNext,
}: UseRecordCycleOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key === '[' && canPrevious) {
        e.preventDefault()
        onPrevious()
      } else if (e.key === ']' && canNext) {
        e.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canNext, canPrevious, onNext, onPrevious])
}
