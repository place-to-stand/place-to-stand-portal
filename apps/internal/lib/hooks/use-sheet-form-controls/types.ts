import type { FieldValues, UseFormReturn } from 'react-hook-form'

import type { SheetSaveMode } from '@/lib/sheets/save-mode'

export type FormSnapshot<T extends FieldValues> = {
  values: T
  externalState?: unknown
  signature: string
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
}
