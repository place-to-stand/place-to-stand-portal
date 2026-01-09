'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type UsersNavTab = 'users' | 'archive' | 'activity'

type UsersTabsNavProps = {
  activeTab: UsersNavTab
  className?: string
}

const USERS_TABS: Array<{ label: string; value: UsersNavTab; href: string }> = [
  { label: 'Users', value: 'users', href: '/settings/users' },
  { label: 'Archive', value: 'archive', href: '/settings/users/archive' },
  { label: 'Activity', value: 'activity', href: '/settings/users/activity' },
]

export function UsersTabsNav({ activeTab, className }: UsersTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = USERS_TABS.find(tab => tab.value === nextValue)
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
        {USERS_TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5 text-sm'>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
