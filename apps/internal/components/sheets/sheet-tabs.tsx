'use client'

import { useCallback, useState, type ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

/** The URL param that deep-links a sheet tab (`&tab=billing`). */
export const SHEET_TAB_PARAM = 'tab'

export type SheetTab = {
  value: string
  label: string
  /** Shows a dot when the tab holds unsaved edits. */
  dirty?: boolean
  content: ReactNode
}

/**
 * The selected tab of a sheet, mirrored to `?tab=` so a link can open a tab.
 * Falls back to the first tab when the param is missing or not one of these.
 */
export function useSheetTab(values: string[]) {
  const { getAux, setAux } = useSheetParams()
  const requested = getAux(SHEET_TAB_PARAM)
  const fromUrl =
    requested && values.includes(requested) ? requested : values[0]
  // Local first so a click switches at once; the URL catches up after.
  const [value, setLocal] = useState(fromUrl)
  const [lastUrlValue, setLastUrlValue] = useState(fromUrl)
  if (fromUrl !== lastUrlValue) {
    // Back/forward or a shared link changed the tab: adopt it.
    setLastUrlValue(fromUrl)
    setLocal(fromUrl)
  }
  const setValue = useCallback(
    (next: string) => {
      setLocal(next)
      setLastUrlValue(next)
      setAux(SHEET_TAB_PARAM, next === values[0] ? null : next)
    },
    [setAux, values]
  )
  return [values.includes(value) ? value : values[0], setValue] as const
}

/**
 * Tabs for an entity sheet: a tab row under the header, one panel per tab.
 * Every panel stays mounted, so switching tabs never drops unsaved edits and
 * the sheet's one Save saves all of them.
 */
export function SheetTabs({
  tabs,
  value,
  onValueChange,
  className,
}: {
  tabs: SheetTab[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={cn('gap-0', className)}
    >
      <div className='bg-background sticky top-0 z-10 border-b px-2.5 pt-2'>
        <TabsList aria-label='Sections' variant='line'>
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.dirty ? (
                <span
                  aria-label='Unsaved changes'
                  className='bg-warning size-1.5 rounded-full'
                />
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map(tab => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          keepMounted
          className='flex flex-col gap-6 px-6 pt-6 pb-8 data-[hidden]:hidden'
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
