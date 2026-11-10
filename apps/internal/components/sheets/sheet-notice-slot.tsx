'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'

import { cn } from '@/lib/utils'

type NoticeSlot = {
  node: HTMLDivElement | null
  setNode: (node: HTMLDivElement | null) => void
}

const SheetNoticeContext = createContext<NoticeSlot>({
  node: null,
  setNode: () => {},
})

/** Held by each `Sheet`, so a stacked sheet gets its own slot. */
export function SheetNoticeProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  return (
    <SheetNoticeContext.Provider value={{ node, setNode }}>
      {children}
    </SheetNoticeContext.Provider>
  )
}

/**
 * Where the sheet's notices go: in the form, above the first field. Hidden
 * while empty. A notice carries its own space below (it eases in and out
 * with it), so the slot cancels the form's 24px gap: put it in a
 * `gap-6` column, or pass `mb-0` where the form has no gap.
 */
export function SheetNoticeSlot({ className }: { className?: string }) {
  const { setNode } = useContext(SheetNoticeContext)
  return <div ref={setNode} className={cn('-mb-6 empty:hidden', className)} />
}

/** The slot's element, for `createPortal`; null until the form renders. */
export function useSheetNoticeSlot(): HTMLDivElement | null {
  return useContext(SheetNoticeContext).node
}
