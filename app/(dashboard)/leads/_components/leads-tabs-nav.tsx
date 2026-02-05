'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type LeadsNavTab = 'board' | 'analytics' | 'forecast' | 'actions'

type LeadsTabsNavProps = {
  activeTab: LeadsNavTab
  className?: string
}

const LEADS_TABS: Array<{ label: string; value: LeadsNavTab; href: string }> = [
  { label: 'Board', value: 'board', href: '/leads/board' },
  { label: 'Analytics', value: 'analytics', href: '/leads/analytics' },
  { label: 'Forecast', value: 'forecast', href: '/leads/forecast' },
  { label: 'Actions', value: 'actions', href: '/leads/actions' },
]

export function LeadsTabsNav({ activeTab, className }: LeadsTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = LEADS_TABS.find(tab => tab.value === nextValue)
      if (target) {
        router.push(target.href)
      }
    },
    [router]
  )

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleValueChange}
      className={cn('w-full sm:w-auto', className)}
    >
      <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
        {LEADS_TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5 text-sm'>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
