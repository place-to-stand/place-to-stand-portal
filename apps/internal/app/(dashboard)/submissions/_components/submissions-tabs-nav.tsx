'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type SubmissionsNavTab = 'submissions' | 'archive' | 'activity'

type SubmissionsTabsNavProps = {
  activeTab: SubmissionsNavTab
  className?: string
}

const SUBMISSIONS_TABS: Array<{
  label: string
  value: SubmissionsNavTab
  href: string
}> = [
  { label: 'Submissions', value: 'submissions', href: '/submissions' },
  { label: 'Archive', value: 'archive', href: '/submissions/archive' },
  { label: 'Activity', value: 'activity', href: '/submissions/activity' },
]

export function SubmissionsTabsNav({
  activeTab,
  className,
}: SubmissionsTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = SUBMISSIONS_TABS.find(tab => tab.value === nextValue)
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
        {SUBMISSIONS_TABS.map(tab => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className='px-3 py-1.5 text-sm'
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
