'use client'

import { useEffect, useRef } from 'react'

import { parseSheetStack } from './stack'
import { useSheetParams } from './use-sheet-params'

/**
 * Holds the stack id of the create sheet a picker opened (as `openNew`
 * returned it), so the picker takes only that sheet's record. Draft ids are
 * positional (`contact:new:0`), so a later draft can get the same id: once
 * the awaited sheet leaves the stack unsaved, the id is let go.
 */
export function useAwaitedCreate() {
  const { stack } = useSheetParams()
  const awaiting = useRef<string | null>(null)
  const signature = stack.map(item => item.id).join('|')
  useEffect(() => {
    if (!awaiting.current) return
    // The live URL: `stack` can lag an open that just happened.
    const live = parseSheetStack(new URLSearchParams(window.location.search))
    if (!live.some(item => item.id === awaiting.current)) {
      awaiting.current = null
    }
  }, [signature])
  return awaiting
}
