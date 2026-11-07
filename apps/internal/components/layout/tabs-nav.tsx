'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { cn } from '@/lib/utils'

export type TabsNavTab = {
  value: string
  label: string
  href: string
}

/**
 * The page toolbar's tab strip. 32px, the height of the page's buttons, so
 * the toolbar is no taller than its tallest control, with a 4px inset that
 * PageShell matches after the action button. Tabs hug the left edge at every
 * width and scroll sideways once they outgrow the screen, instead of
 * stretching or clipping. Shared with the project board's own tab strip.
 */
export const TOOLBAR_TABS_LIST_CLASS =
  'bg-muted/40 h-8 w-fit max-w-full [scrollbar-width:none] justify-start gap-2 overflow-x-auto rounded-lg px-1 py-0.5'
export const TOOLBAR_TAB_CLASS = 'h-full flex-none px-3 py-0 text-sm'

type TabsNavProps = {
  tabs: readonly TabsNavTab[]
  activeTab: string
  className?: string
}

/**
 * Config-driven tab strip for section navigation (PRD 004 §01, D11).
 * Replaces the nine per-feature `*TabsNav` copies; tab arrays live in
 * colocated `_lib/tabs.ts` files per feature.
 */
export function TabsNav({ tabs, activeTab, className }: TabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = tabs.find(tab => tab.value === nextValue)
      if (target) {
        router.push(target.href)
      }
    },
    [router, tabs]
  )

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleValueChange}
      className={cn('w-full sm:w-auto', className)}
    >
      <TabsList className={TOOLBAR_TABS_LIST_CLASS}>
        {tabs.map(tab => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={TOOLBAR_TAB_CLASS}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
