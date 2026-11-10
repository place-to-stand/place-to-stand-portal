'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FieldValues } from 'react-hook-form'

import { cloneData, cloneValues } from './clone'
import {
  buildSnapshot,
  withSourceSlice,
  type HistoryExternalState,
} from './snapshot'
import type {
  FormHistoryArgs,
  FormHistoryReturn,
  FormSnapshot,
  SheetHistorySource,
} from './types'

const DEFAULT_MAX_SNAPSHOTS = 100
const DEFAULT_DEBOUNCE_MS = 300

const runSoon = (task: () => void) => {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task)
  } else {
    void Promise.resolve().then(task)
  }
}

/**
 * A sheet's undo/redo stack.
 *
 * The first entry is always the record as loaded (or as last saved): never
 * the blank form the sheet opened with. Whenever the form's saved state
 * changes (`reset`, or `resetField` with a new default, as a record loads,
 * a late field loads, or a save lands) the stack starts again from what the
 * form then holds, so a load is never an undoable step.
 *
 * State kept outside the form joins the stack as a source (see
 * `useSheetHistoryState`); a source's own loads and saves replace its part
 * of every entry instead of adding one.
 */
export function useFormHistory<T extends FieldValues>({
  form,
  isActive,
  historyKey,
  maxSnapshots,
  debounceMs,
  getExternalState,
  applyExternalState,
}: FormHistoryArgs<T>): FormHistoryReturn {
  const historyRef = useRef<FormSnapshot<T>[]>([])
  const indexRef = useRef(-1)
  const isApplyingRef = useRef(false)
  const defaultsSignatureRef = useRef<string | null>(null)
  const pendingSnapshotRef = useRef<{
    values: T
    externalState: HistoryExternalState
  } | null>(null)
  const debounceTimerRef = useRef<number | null>(null)
  const sourcesRef = useRef(new Map<string, SheetHistorySource>())
  const isActiveRef = useRef(isActive)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Read through refs so the subscription effect below never re-runs (and
  // restarts the stack) because a caller passed a new function.
  const getExternalStateRef = useRef(getExternalState)
  const applyExternalStateRef = useRef(applyExternalState)
  useEffect(() => {
    getExternalStateRef.current = getExternalState
    applyExternalStateRef.current = applyExternalState
    isActiveRef.current = isActive
  })

  const effectiveMaxSnapshots = maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS
  const effectiveDebounceMs = debounceMs ?? DEFAULT_DEBOUNCE_MS

  const readExternalState = useCallback((): HistoryExternalState => {
    const sources: Record<string, unknown> = {}
    sourcesRef.current.forEach((source, key) => {
      sources[key] = cloneData(source.get())
    })
    const own = getExternalStateRef.current?.()
    return {
      own: own === undefined ? null : cloneData(own),
      sources,
    }
  }, [])

  const readDefaultsSignature = useCallback(
    () => JSON.stringify(form.control._defaultValues ?? null),
    [form]
  )

  const clearPendingTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  const dropPendingSnapshot = useCallback(() => {
    pendingSnapshotRef.current = null
    clearPendingTimer()
  }, [clearPendingTimer])

  const refreshCapabilities = useCallback(() => {
    setCanUndo(indexRef.current > 0)
    setCanRedo(
      indexRef.current >= 0 && indexRef.current < historyRef.current.length - 1
    )
  }, [])

  const pushSnapshot = useCallback(
    (values: T, externalState: HistoryExternalState) => {
      const snapshot = buildSnapshot(values, externalState)
      const currentHistory = historyRef.current
      const currentIndex = indexRef.current
      const currentSnapshot = currentHistory[currentIndex]

      if (currentSnapshot && currentSnapshot.signature === snapshot.signature) {
        return
      }

      const nextHistory = currentHistory.slice(0, currentIndex + 1)
      nextHistory.push(snapshot)
      if (nextHistory.length > effectiveMaxSnapshots) {
        nextHistory.splice(0, nextHistory.length - effectiveMaxSnapshots)
      }

      historyRef.current = nextHistory
      indexRef.current = nextHistory.length - 1
      refreshCapabilities()
    },
    [effectiveMaxSnapshots, refreshCapabilities]
  )

  const flushPendingSnapshots = useCallback(() => {
    const snapshot = pendingSnapshotRef.current
    dropPendingSnapshot()
    if (snapshot) {
      pushSnapshot(snapshot.values, snapshot.externalState)
    }
  }, [dropPendingSnapshot, pushSnapshot])

  /** Starts the stack again from what the sheet holds now. */
  const resetHistory = useCallback(() => {
    dropPendingSnapshot()
    defaultsSignatureRef.current = readDefaultsSignature()
    historyRef.current = [
      buildSnapshot(cloneValues(form.getValues()), readExternalState()),
    ]
    indexRef.current = 0
    refreshCapabilities()
  }, [
    dropPendingSnapshot,
    form,
    readDefaultsSignature,
    readExternalState,
    refreshCapabilities,
  ])

  const applySnapshot = useCallback(
    (snapshot: FormSnapshot<T>, nextIndex: number) => {
      isApplyingRef.current = true
      dropPendingSnapshot()
      // Restore values without re-baselining: a plain reset(values) also
      // replaces the defaults, so isDirty would read false after any undo or
      // redo and closing the sheet would drop the edit without a prompt.
      form.reset(cloneValues(snapshot.values), { keepDefaultValues: true })

      applyExternalStateRef.current?.(snapshot.externalState.own)
      for (const [key, slice] of Object.entries(
        snapshot.externalState.sources
      )) {
        sourcesRef.current.get(key)?.apply(cloneData(slice))
      }

      indexRef.current = nextIndex
      refreshCapabilities()
      runSoon(() => {
        isApplyingRef.current = false
      })
    },
    [dropPendingSnapshot, form, refreshCapabilities]
  )

  const scheduleSnapshot = useCallback(() => {
    if (!isActiveRef.current || isApplyingRef.current) {
      return
    }

    const values = cloneValues(form.getValues())
    const externalState = readExternalState()

    if (effectiveDebounceMs <= 0) {
      pushSnapshot(values, externalState)
      return
    }

    pendingSnapshotRef.current = { values, externalState }
    clearPendingTimer()
    debounceTimerRef.current = window.setTimeout(
      flushPendingSnapshots,
      effectiveDebounceMs
    )
  }, [
    clearPendingTimer,
    effectiveDebounceMs,
    flushPendingSnapshots,
    form,
    pushSnapshot,
    readExternalState,
  ])

  const step = useCallback(
    (direction: -1 | 1) => {
      flushPendingSnapshots()
      const nextIndex = indexRef.current + direction
      const snapshot = historyRef.current[nextIndex]
      if (nextIndex < 0 || !snapshot) return
      applySnapshot(snapshot, nextIndex)
    },
    [applySnapshot, flushPendingSnapshots]
  )
  const undo = useCallback(() => step(-1), [step])
  const redo = useCallback(() => step(1), [step])

  useEffect(() => {
    if (!isActive) {
      flushPendingSnapshots()
      return
    }

    resetHistory()

    // Decided once the change settles: a reset fires an event per field
    // it touches, and resetField fires its event before it moves the
    // default, so only afterwards can a load be told from an edit.
    const handleChange = () => {
      if (!isActiveRef.current) return
      if (readDefaultsSignature() !== defaultsSignatureRef.current) {
        // The saved state moved: a load or a save, not an edit.
        resetHistory()
        return
      }
      scheduleSnapshot()
    }
    const subscription = form.watch(() => {
      if (isApplyingRef.current) return
      runSoon(handleChange)
    })

    return () => {
      subscription.unsubscribe()
      flushPendingSnapshots()
    }
  }, [
    flushPendingSnapshots,
    form,
    historyKey,
    isActive,
    readDefaultsSignature,
    resetHistory,
    scheduleSnapshot,
  ])

  const notifyExternalChange = useCallback(() => {
    scheduleSnapshot()
  }, [scheduleSnapshot])

  const rebaseline = useCallback(() => {
    if (isActiveRef.current) resetHistory()
  }, [resetHistory])

  /** Writes a source's current state into every entry (no new entry). */
  const settleSource = useCallback(
    (key: string) => {
      const source = sourcesRef.current.get(key)
      if (!source) return
      flushPendingSnapshots()
      const slice = cloneData(source.get())
      historyRef.current = historyRef.current.map(snapshot =>
        withSourceSlice(snapshot, key, slice)
      )
    },
    [flushPendingSnapshots]
  )

  const registerSource = useCallback(
    (key: string, source: SheetHistorySource) => {
      sourcesRef.current.set(key, source)
      // Loaded state, not an edit: it belongs in every entry.
      settleSource(key)
      return () => {
        if (sourcesRef.current.get(key) !== source) return
        sourcesRef.current.delete(key)
        historyRef.current = historyRef.current.map(snapshot =>
          withSourceSlice(snapshot, key, undefined)
        )
      }
    },
    [settleSource]
  )

  const sources = useMemo(
    () => ({
      register: registerSource,
      settle: settleSource,
      notify: notifyExternalChange,
    }),
    [notifyExternalChange, registerSource, settleSource]
  )

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    flushPendingSnapshots,
    notifyExternalChange,
    rebaseline,
    sources,
  }
}
