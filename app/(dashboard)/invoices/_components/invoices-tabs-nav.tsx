'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type InvoicesNavTab = 'invoices' | 'settings'

type InvoicesTabsNavProps = {
  activeTab: InvoicesNavTab
  className?: string
}

const INVOICE_TABS: Array<{ label: string; value: InvoicesNavTab; href: string }> = [
  { label: 'Invoices', value: 'invoices', href: '/invoices' },
  { label: 'Settings', value: 'settings', href: '/invoices/settings' },
]

export function InvoicesTabsNav({ activeTab, className }: InvoicesTabsNavProps) {
  const router = useRouter()

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = INVOICE_TABS.find(tab => tab.value === nextValue)
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
        {INVOICE_TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5 text-sm'>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
