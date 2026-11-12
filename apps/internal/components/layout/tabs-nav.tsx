'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@pts/ui/tabs'
import { cn } from '@/lib/utils'

import { TOOLBAR_TAB_CLASS, TOOLBAR_TABS_LIST_CLASS } from './tabs-nav-classes'
import { ToolbarTabsMenu } from './toolbar-tabs-menu'

export { TOOLBAR_TAB_CLASS, TOOLBAR_TABS_LIST_CLASS }

export type TabsNavTab = {
  value: string
  label: string
  href: string
}

type TabsNavProps = {
  tabs: readonly TabsNavTab[]
  activeTab: string
  className?: string
}

/**
 * Picks up a tab the moment it is clicked, before the route catches up, so
 * the strip never lags the click. A new `activeTab` from the server clears it.
 */
export function useOptimisticTab(activeTab: string) {
  const [pending, setPending] = useState<string | null>(null)
  const [settledTab, setSettledTab] = useState(activeTab)
  if (settledTab !== activeTab) {
    setSettledTab(activeTab)
    setPending(null)
  }
  return [pending ?? activeTab, setPending] as const
}

/**
 * Config-driven tab strip for section navigation (PRD 004 §01, D11).
 * Replaces the nine per-feature `*TabsNav` copies; tab arrays live in
 * colocated `_lib/tabs.ts` files per feature. Below `sm` the strip folds
 * into `ToolbarTabsMenu`, so the toolbar row stays one line on phones.
 */
export function TabsNav({ tabs, activeTab, className }: TabsNavProps) {
  const router = useRouter()
  const [shownTab, setShownTab] = useOptimisticTab(activeTab)

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = tabs.find(tab => tab.value === nextValue)
      if (target) {
        setShownTab(nextValue)
        router.push(target.href)
      }
    },
    [router, tabs, setShownTab]
  )

  return (
    <>
      <ToolbarTabsMenu
        tabs={tabs}
        activeTab={shownTab}
        onSelect={setShownTab}
        className={cn('sm:hidden', className)}
      />
      <Tabs
        value={shownTab}
        onValueChange={handleValueChange}
        className={cn('hidden sm:flex', className)}
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
    </>
  )
}
