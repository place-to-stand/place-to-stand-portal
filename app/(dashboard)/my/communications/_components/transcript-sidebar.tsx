'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Inbox,
  CircleDashed,
  CheckCircle,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'

type View = 'inbox' | 'unclassified' | 'classified' | 'dismissed'

interface TranscriptSidebarProps {
  currentView: View
  counts: {
    total: number
    unclassified: number
    classified: number
    dismissed: number
  }
  preservedParams?: {
    transcript?: string | null
    q?: string | null
    client?: string | null
    project?: string | null
    lead?: string | null
  }
}

const navItems: Array<{
  view: View
  label: string
  icon: typeof Inbox
  href: string
  countKey?: 'total' | 'unclassified' | 'classified'
  section?: string
}> = [
  { view: 'inbox', label: 'All Transcripts', icon: Inbox, href: '/my/communications/transcripts' },
  { view: 'unclassified', label: 'Unclassified', icon: CircleDashed, href: '/my/communications/transcripts/unclassified', countKey: 'unclassified', section: 'Classification' },
  { view: 'classified', label: 'Classified', icon: CheckCircle, href: '/my/communications/transcripts/classified', countKey: 'classified' },
  { view: 'dismissed', label: 'Dismissed', icon: XCircle, href: '/my/communications/transcripts/dismissed' },
]

export function TranscriptSidebar({ currentView, counts, preservedParams }: TranscriptSidebarProps) {
  const itemsWithSectionFlags = useMemo(() => {
    const result: Array<typeof navItems[number] & { showSectionHeader: boolean }> = []
    navItems.reduce((lastSection: string | undefined, item) => {
      const showSectionHeader = item.section && item.section !== lastSection
      result.push({ ...item, showSectionHeader: !!showSectionHeader })
      return item.section ?? lastSection
    }, undefined)
    return result
  }, [])

  const buildViewUrl = (item: typeof navItems[number]): string => {
    const base = item.href
    const params = new URLSearchParams()
    if (preservedParams?.transcript) params.set('transcript', preservedParams.transcript)
    if (preservedParams?.q) params.set('q', preservedParams.q)
    if (preservedParams?.client) params.set('client', preservedParams.client)
    if (preservedParams?.project) params.set('project', preservedParams.project)
    if (preservedParams?.lead) params.set('lead', preservedParams.lead)
    return params.toString() ? `${base}?${params.toString()}` : base
  }

  return (
    <nav className='space-y-0.5 px-3'>
      {itemsWithSectionFlags.map(item => {
        const count = item.countKey ? counts[item.countKey] : 0

        return (
          <div key={item.view}>
            {item.showSectionHeader && (
              <p className='text-muted-foreground/60 mb-1 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide'>
                {item.section}
              </p>
            )}
            <Link
              href={buildViewUrl(item)}
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

export type { View as TranscriptView }
