'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Inbox,
  FileEdit,
  Send,
  Clock,
  CircleDashed,
  CheckCircle,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'

type View = 'inbox' | 'drafts' | 'sent' | 'scheduled' | 'unclassified' | 'classified' | 'dismissed'

interface InboxSidebarProps {
  currentView: View
  counts: {
    inbox: number
    unread: number
    drafts: number
    sent: number
    scheduled: number
    unclassified: number
    classified: number
  }
  /** Query params to preserve across view changes */
  preservedParams?: {
    thread?: string | null
    q?: string | null
  }
}

const navItems: Array<{
  view: View
  label: string
  icon: typeof Inbox
  href: string
  showCount?: 'unread' | 'total'
  section?: string
  isExternal?: boolean
}> = [
  { view: 'inbox', label: 'Inbox', icon: Inbox, href: '/my/inbox/emails', showCount: 'unread' },
  { view: 'drafts', label: 'Drafts', icon: FileEdit, href: '/my/inbox/emails/drafts', showCount: 'total' },
  { view: 'sent', label: 'Sent', icon: Send, href: '/my/inbox/emails/sent' },
  { view: 'scheduled', label: 'Scheduled', icon: Clock, href: '/my/inbox/emails/scheduled', showCount: 'total' },
  { view: 'unclassified', label: 'Unclassified', icon: CircleDashed, href: '/my/inbox/emails/unclassified', showCount: 'total', section: 'Classification' },
  { view: 'classified', label: 'Classified', icon: CheckCircle, href: '/my/inbox/emails/classified', showCount: 'total' },
  { view: 'dismissed', label: 'Dismissed', icon: XCircle, href: '/my/inbox/emails/dismissed' },
]

export function InboxSidebar({ currentView, counts, preservedParams }: InboxSidebarProps) {
  // Pre-compute which items should show section headers using reduce to avoid reassignment
  const itemsWithSectionFlags = useMemo(() => {
    const result: Array<typeof navItems[number] & { showSectionHeader: boolean }> = []
    navItems.reduce((lastSection: string | undefined, item) => {
      const showSectionHeader = item.section && item.section !== lastSection
      result.push({ ...item, showSectionHeader: !!showSectionHeader })
      return item.section ?? lastSection
    }, undefined)
    return result
  }, [])

  // Build URL that preserves thread and search params across view changes
  const buildViewUrl = (view: View): string => {
    const base = view === 'inbox' ? '/my/inbox/emails' : `/my/inbox/emails/${view}`
    const params = new URLSearchParams()
    // Preserve thread param (selected thread is independent of view)
    if (preservedParams?.thread) params.set('thread', preservedParams.thread)
    // Preserve search query
    if (preservedParams?.q) params.set('q', preservedParams.q)
    return params.toString() ? `${base}?${params.toString()}` : base
  }

  return (
    <nav className='space-y-0.5 px-3'>
      {itemsWithSectionFlags.map(item => {
        const count =
          item.view === 'inbox' && item.showCount === 'unread'
            ? counts.unread
            : item.view === 'drafts'
              ? counts.drafts
              : item.view === 'scheduled'
                ? counts.scheduled
                : item.view === 'unclassified'
                  ? counts.unclassified
                  : item.view === 'classified'
                    ? counts.classified
                    : 0

        return (
          <div key={item.view}>
            {item.showSectionHeader && (
              <p className='text-muted-foreground/60 mb-1 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide'>
                {item.section}
              </p>
            )}
            <Link
              href={item.isExternal ? item.href : buildViewUrl(item.view)}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] transition',
                currentView === item.view
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className='size-3.5 shrink-0' />
              <span className='flex-1 text-left'>{item.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    currentView === item.view
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : item.view === 'inbox' && counts.unread > 0
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}

export type { View as InboxView }
