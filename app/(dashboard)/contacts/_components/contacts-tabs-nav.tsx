'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type ContactsNavTab = 'contacts' | 'archive' | 'activity'

type ContactsTabsNavProps = {
  activeTab: ContactsNavTab
  className?: string
}

const CONTACT_TABS: Array<{ label: string; value: ContactsNavTab; href: string }> = [
  { label: 'All Contacts', value: 'contacts', href: '/contacts' },
  { label: 'Archive', value: 'archive', href: '/contacts/archive' },
  { label: 'Activity', value: 'activity', href: '/contacts/activity' },
]

export function ContactsTabsNav({ activeTab, className }: ContactsTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = CONTACT_TABS.find(tab => tab.value === nextValue)
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
        {CONTACT_TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5 text-sm'>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
