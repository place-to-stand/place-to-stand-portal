'use client'

import { useEffect, useRef } from 'react'

import type { SheetHistorySources } from './types'

type SheetHistoryStateOptions<S> = {
  /** Plain data (it is cloned and compared as JSON). */
  state: S
  /** Puts an earlier `state` back. */
  restore: (state: S) => void
  /**
   * False while the state is still loading: nothing is recorded until it
   * turns true, and the state it then holds is the loaded one, not an edit.
   */
  ready?: boolean
  /**
   * Changes when the state was just reloaded or saved (not edited): the
   * stack takes the new state as its starting point instead of an entry.
   */
  savedKey?: unknown
}

/**
 * Puts state kept outside a sheet's form (useState, a second form) on the
 * sheet's undo stack: every edit to it is a step, and undo and redo
 * restore it with the form.
 */
export function useSheetHistoryState<S>(
  sources: SheetHistorySources | null,
  key: string,
  { state, restore, ready = true, savedKey }: SheetHistoryStateOptions<S>
) {
  const stateRef = useRef(state)
  const restoreRef = useRef(restore)
  const signature = JSON.stringify(state ?? null)
  const lastSignatureRef = useRef(signature)
  const lastSavedKeyRef = useRef(savedKey)
  const active = Boolean(sources) && ready

  useEffect(() => {
    stateRef.current = state
    restoreRef.current = restore
  })

  useEffect(() => {
    if (!sources || !ready) return
    lastSignatureRef.current = JSON.stringify(stateRef.current ?? null)
    return sources.register(key, {
      get: () => stateRef.current,
      apply: next => restoreRef.current(next as S),
    })
  }, [key, ready, sources])

  useEffect(() => {
    const savedKeyChanged = !Object.is(lastSavedKeyRef.current, savedKey)
    const changed = lastSignatureRef.current !== signature
    lastSavedKeyRef.current = savedKey
    lastSignatureRef.current = signature
    if (!active || !sources) return
    if (savedKeyChanged) {
      sources.settle(key)
    } else if (changed) {
      sources.notify()
    }
  }, [active, key, savedKey, signature, sources])
}
