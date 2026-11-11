import type { SheetStackItem } from '../use-sheet-params'

export type SheetWrapperProps = {
  /** The entity param's value: a UUID or `new`. */
  value: string
  /**
   * Drives the sheet's open state. The host flips this to false on close and
   * keeps the wrapper mounted through the exit transition, so wrappers must
   * pass it straight through rather than hardcoding `open`.
   */
  open: boolean
  /**
   * The full sheet stack in URL (mount) order — lets a `new` wrapper read
   * context from the sheets below it (e.g. task-on-lead inherits the lead id).
   */
  stack: SheetStackItem[]
  /** This sheet's entry in `stack` (`SheetStackItem.key`). */
  stackKey: string
  /** Close this sheet: animates immediately, then clears its param. */
  onRequestClose: () => void
}
