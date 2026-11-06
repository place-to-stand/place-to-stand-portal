'use client'

import { useEffect } from 'react'

import { isEditableTarget, matchesShortcut } from '@/lib/keyboard/match'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'

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
      // A sheet open over the board keeps its fields' keys to itself.
      if (isEditableTarget(e.target)) return
      if (matchesShortcut(e, SHORTCUTS.previousProject) && canPrevious) {
        e.preventDefault()
        onPrevious()
      } else if (matchesShortcut(e, SHORTCUTS.nextProject) && canNext) {
        e.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canNext, canPrevious, onNext, onPrevious])
}
