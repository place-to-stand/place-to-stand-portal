'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type HourBlocksNavTab = 'hour-blocks' | 'archive' | 'activity'

type HourBlocksTabsNavProps = {
  activeTab: HourBlocksNavTab
  className?: string
}

const HOUR_BLOCKS_TABS: Array<{ label: string; value: HourBlocksNavTab; href: string }> = [
  { label: 'Hour Blocks', value: 'hour-blocks', href: '/hour-blocks' },
  { label: 'Archive', value: 'archive', href: '/hour-blocks/archive' },
  { label: 'Activity', value: 'activity', href: '/hour-blocks/activity' },
]

export function HourBlocksTabsNav({ activeTab, className }: HourBlocksTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = HOUR_BLOCKS_TABS.find(tab => tab.value === nextValue)
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
        {HOUR_BLOCKS_TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5 text-sm'>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
