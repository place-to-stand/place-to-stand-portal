'use client'

import Link from 'next/link'
import {
  Inbox,
  FileEdit,
  Send,
  Clock,
  Users,
  FolderKanban,
  LinkIcon,
  Unlink,
} from 'lucide-react'

import { cn } from '@/lib/utils'

type View = 'inbox' | 'drafts' | 'sent' | 'scheduled' | 'by-client' | 'by-project' | 'linked' | 'unlinked'

interface InboxSidebarProps {
  currentView: View
  counts: {
    inbox: number
    unread: number
    drafts: number
    sent: number
    scheduled: number
    linked: number
    unlinked: number
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
}> = [
  { view: 'inbox', label: 'Inbox', icon: Inbox, href: '/my/inbox', showCount: 'unread' },
  { view: 'drafts', label: 'Drafts', icon: FileEdit, href: '/my/inbox?view=drafts', showCount: 'total' },
  { view: 'sent', label: 'Sent', icon: Send, href: '/my/inbox?view=sent' },
  { view: 'scheduled', label: 'Scheduled', icon: Clock, href: '/my/inbox?view=scheduled', showCount: 'total' },
  { view: 'linked', label: 'Linked', icon: LinkIcon, href: '/my/inbox?view=linked', showCount: 'total', section: 'Portal Views' },
  { view: 'unlinked', label: 'Unlinked', icon: Unlink, href: '/my/inbox?view=unlinked', showCount: 'total' },
  { view: 'by-client', label: 'By Client', icon: Users, href: '/my/inbox?view=by-client', section: 'Browse' },
  { view: 'by-project', label: 'By Project', icon: FolderKanban, href: '/my/inbox?view=by-project' },
]

export function InboxSidebar({ currentView, counts, preservedParams }: InboxSidebarProps) {
  let currentSection: string | undefined

  // Build URL that preserves thread and search params across view changes
  const buildViewUrl = (view: View): string => {
    const params = new URLSearchParams()
    // Preserve thread param (selected thread is independent of view)
    if (preservedParams?.thread) params.set('thread', preservedParams.thread)
    // Preserve search query
    if (preservedParams?.q) params.set('q', preservedParams.q)
    // Set view (omit for inbox default)
    if (view !== 'inbox') params.set('view', view)
    return params.toString() ? `/my/inbox?${params.toString()}` : '/my/inbox'
  }

  return (
    <nav className='flex flex-col gap-1 p-3'>
      {navItems.map(item => {
        const showSectionHeader = item.section && item.section !== currentSection
        if (item.section) currentSection = item.section

        const count =
          item.view === 'inbox' && item.showCount === 'unread'
            ? counts.unread
            : item.view === 'drafts'
              ? counts.drafts
              : item.view === 'scheduled'
                ? counts.scheduled
                : item.view === 'linked'
                  ? counts.linked
                  : item.view === 'unlinked'
                    ? counts.unlinked
                    : 0

        return (
          <div key={item.view}>
            {showSectionHeader && (
              <div className='text-muted-foreground mt-4 mb-2 px-3 text-xs font-medium uppercase tracking-wider'>
                {item.section}
              </div>
            )}
            <Link
              href={buildViewUrl(item.view)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                currentView === item.view
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className='h-4 w-4 flex-shrink-0' />
              <span className='flex-1 text-left'>{item.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
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
