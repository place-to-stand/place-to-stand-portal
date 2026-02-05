'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type ProposalsNavTab = 'proposals' | 'archive' | 'activity'

type ProposalsTabsNavProps = {
  activeTab: ProposalsNavTab
  className?: string
}

const PROPOSAL_TABS: Array<{ label: string; value: ProposalsNavTab; href: string }> = [
  { label: 'All Proposals', value: 'proposals', href: '/proposals' },
  { label: 'Archive', value: 'archive', href: '/proposals/archive' },
  { label: 'Activity', value: 'activity', href: '/proposals/activity' },
]

export function ProposalsTabsNav({ activeTab, className }: ProposalsTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = PROPOSAL_TABS.find(tab => tab.value === nextValue)
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
        {PROPOSAL_TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5 text-sm'>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
