'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type InboxNavTab = 'triage' | 'emails' | 'transcripts'

interface InboxTabsProps {
  unclassifiedCount: number
  unclassifiedTranscriptCount?: number
  className?: string
}

const INBOX_TABS: Array<{
  label: string
  value: InboxNavTab
  href: string
}> = [
  { label: 'All Triage', value: 'triage', href: '/my/inbox/triage' },
  { label: 'Emails', value: 'emails', href: '/my/inbox/emails' },
  {
    label: 'Transcripts',
    value: 'transcripts',
    href: '/my/inbox/transcripts',
  },
]

export function InboxTabs({
  unclassifiedCount,
  unclassifiedTranscriptCount = 0,
  className,
}: InboxTabsProps) {
  const router = useRouter()
  const pathname = usePathname()

  const activeTab: InboxNavTab = pathname.startsWith('/my/inbox/triage')
    ? 'triage'
    : pathname.startsWith('/my/inbox/transcripts')
      ? 'transcripts'
      : 'emails'

  const visibleTabs = INBOX_TABS

  const handleValueChange = useCallback(
    (nextValue: string) => {
      const target = INBOX_TABS.find(tab => tab.value === nextValue)
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
        {visibleTabs.map(tab => {
          const badgeCount =
            tab.value === 'triage'
              ? unclassifiedCount + unclassifiedTranscriptCount
              : tab.value === 'emails'
                ? unclassifiedCount
                : tab.value === 'transcripts'
                  ? unclassifiedTranscriptCount
                  : 0

          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className='px-3 py-1.5 text-sm'
            >
              {tab.label}
              {badgeCount > 0 && (
                <span className='bg-primary text-primary-foreground ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium'>
                  {badgeCount}
                </span>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
