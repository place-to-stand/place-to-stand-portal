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

/** Where the sheet's notices go: in the form, above the first field. */
export function SheetNoticeSlot({ className }: { className?: string }) {
  const { setNode } = useContext(SheetNoticeContext)
  return <div ref={setNode} className={cn('empty:hidden', className)} />
}

/** The slot's element, for `createPortal`; null until the form renders. */
export function useSheetNoticeSlot(): HTMLDivElement | null {
  return useContext(SheetNoticeContext).node
}
