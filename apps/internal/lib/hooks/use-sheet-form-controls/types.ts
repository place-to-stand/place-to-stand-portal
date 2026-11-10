import type { FieldValues, UseFormReturn } from 'react-hook-form'

import type { SheetSaveMode } from '@/lib/sheets/save-mode'

import type { HistoryExternalState } from './snapshot'

export type FormSnapshot<T extends FieldValues> = {
  values: T
  externalState: HistoryExternalState
  signature: string
}

/** State kept outside the form that undo and redo also step through. */
export type SheetHistorySource = {
  get: () => unknown
  apply: (state: unknown) => void
}

/** How state outside the form joins a sheet's undo stack. */
export type SheetHistorySources = {
  /** Adds a source; its current state counts as loaded, not as an edit. */
  register: (key: string, source: SheetHistorySource) => () => void
  /** The source's current state was loaded or saved: no new entry. */
  settle: (key: string) => void
  /** The source changed by an edit: record an entry. */
  notify: () => void
}

export type UseSheetFormControlsOptions<T extends FieldValues> = {
  form: UseFormReturn<T>
  isActive: boolean
  canSave: boolean
  /** ⌘S calls it with `close`, ⇧⌘S with `stay`. */
  onSave: (mode: SheetSaveMode) => void
  historyKey: string | number
  maxSnapshots?: number
  debounceMs?: number
  getExternalState?: () => unknown
  applyExternalState?: (state: unknown) => void
}

export type UseSheetFormControlsReturn = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  notifyExternalChange: () => void
  /** Starts the stack again from what the sheet holds now. */
  rebaseline: () => void
  /** Pass to `SheetHistoryProvider` (or `useSheetHistoryState`). */
  sources: SheetHistorySources
}

export type FormHistoryArgs<T extends FieldValues> = {
  form: UseFormReturn<T>
  isActive: boolean
  historyKey: string | number
  maxSnapshots?: number
  debounceMs?: number
  getExternalState?: () => unknown
  applyExternalState?: (state: unknown) => void
}

export type FormHistoryReturn = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  flushPendingSnapshots: () => void
  notifyExternalChange: () => void
  rebaseline: () => void
  sources: SheetHistorySources
}
