'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  ChevronRight,
  FileText,
  Mail,
  MessagesSquare,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TriageWidgetItem = {
  id: string
  type: 'email' | 'transcript'
  title: string
  subtitle: string | null
  date: string | null
}

type TriageWidgetProps = {
  items: TriageWidgetItem[]
  totalCount: number
  className?: string
}

export function TriageWidget({
  items,
  totalCount,
  className,
}: TriageWidgetProps) {
  return (
    <section
      className={cn(
        'bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm',
        className
      )}
      aria-labelledby='triage-heading'
    >
      <header className='flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4'>
        <div className='min-w-0 flex-1'>
          <h2 id='triage-heading' className='text-base font-semibold'>
            Communications Triage
          </h2>
          <p className='text-muted-foreground text-xs'>
            Unclassified emails and transcripts awaiting review.
          </p>
        </div>
        <div className='flex items-center gap-3'>
          {totalCount > 0 && (
            <p className='text-muted-foreground text-xs font-medium'>
              {totalCount} item{totalCount !== 1 ? 's' : ''}
            </p>
          )}
          <Button asChild size='sm' variant='outline'>
            <Link
              href='/my/communications/triage'
              aria-label='View all triage items'
            >
              See all
            </Link>
          </Button>
        </div>
      </header>
      <div className='flex-1 overflow-hidden'>
        {items.length > 0 ? (
          <ul className='divide-border flex h-full flex-col divide-y'>
            {items.map(item => (
              <TriageRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-5 py-12 text-center text-sm'>
            <MessagesSquare className='text-muted-foreground/50 h-8 w-8' />
            <p>No items to triage.</p>
            <p className='max-w-xs text-xs'>
              New emails and transcripts that need classification will appear
              here.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function TriageRow({ item }: { item: TriageWidgetItem }) {
  const Icon = item.type === 'email' ? Mail : FileText
  const typeBadgeCls =
    item.type === 'email'
      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'

  return (
    <li className='group relative'>
      <Link
        href='/my/communications/triage'
        className='hover:bg-muted/60 focus-visible:ring-primary focus-visible:ring-offset-background absolute inset-0 z-0 rounded-lg px-5 py-3.5 transition focus-visible:ring-2 focus-visible:ring-offset-2'
        aria-label={`Triage: ${item.title}`}
      />
      <div className='pointer-events-none relative z-10 flex items-center gap-3 px-5 py-3.5'>
        <div className='min-w-0 flex-1 space-y-1'>
          <div className='flex items-center gap-2'>
            <span
              className={cn(
                'inline-flex flex-shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                typeBadgeCls
              )}
            >
              <Icon className='h-3 w-3' />
              {item.type === 'email' ? 'Email' : 'Transcript'}
            </span>
            <span className='text-foreground group-hover:text-primary truncate text-sm font-semibold transition'>
              {item.title}
            </span>
          </div>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            {item.subtitle && (
              <span className='truncate'>{item.subtitle}</span>
            )}
            {item.date && (
              <>
                {item.subtitle && <span className='shrink-0'>·</span>}
                <span className='shrink-0'>
                  {formatDistanceToNow(new Date(item.date), {
                    addSuffix: true,
                  })}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronRight
          className='text-muted-foreground size-4 shrink-0'
          aria-hidden
        />
      </div>
    </li>
  )
}
