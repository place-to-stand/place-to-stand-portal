import type { SheetStackItem } from '../use-sheet-params'

export type SheetWrapperProps = {
  /** The entity param's value: a UUID or `new`. */
  value: string
  /**
   * The full sheet stack in URL (mount) order — lets a `new` wrapper read
   * context from the sheet below it (e.g. task-on-lead inherits the lead id).
   */
  stack: SheetStackItem[]
}
