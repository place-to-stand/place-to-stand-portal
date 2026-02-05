'use client'

import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { AppShellHeader } from '@/components/layout/app-shell'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type TemplatesTab = 'emails' | 'proposals'

const TEMPLATES_TABS: Array<{ label: string; value: TemplatesTab; href: string }> = [
  { label: 'Emails', value: 'emails', href: '/settings/templates/emails' },
  { label: 'Proposals', value: 'proposals', href: '/settings/templates/proposals' },
]

function getActiveTab(pathname: string): TemplatesTab {
  if (pathname.includes('/proposals')) return 'proposals'
  return 'emails'
}

export default function TemplatesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const activeTab = getActiveTab(pathname)

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = TEMPLATES_TABS.find(tab => tab.value === nextValue)
      if (target) {
        router.push(target.href)
      }
    },
    [router]
  )

  return (
    <div className='flex flex-col gap-6'>
      <AppShellHeader>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Templates</h1>
          <p className='text-muted-foreground text-sm'>
            Manage reusable templates for emails, proposals, and more.
          </p>
        </div>
      </AppShellHeader>

      <Tabs value={activeTab} onValueChange={handleValueChange} className='w-full sm:w-auto'>
        <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
          {TEMPLATES_TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className='px-3 py-1.5 text-sm'>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {children}
    </div>
  )
}
