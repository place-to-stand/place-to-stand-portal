'use client'

import dynamic from 'next/dynamic'
import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pts/ui/collapsible'
import type { ActivityFeedProps } from '@/components/activity/activity-feed'
import { useActivityCount } from '@/lib/activity/use-activity-feed'
import { cn } from '@/lib/utils'

// The feed's code loads with the first open, like its entries.
const ActivityFeed = dynamic(
  () =>
    import('@/components/activity/activity-feed').then(
      module => module.ActivityFeed
    ),
  {
    ssr: false,
    loading: () => (
      <div className='text-muted-foreground text-sm'>Loading activity…</div>
    ),
  }
)

type SheetActivitySectionProps = Pick<
  ActivityFeedProps,
  'targetType' | 'targetId' | 'projectId' | 'companyId' | 'emptyState'
> & {
  className?: string
}

/**
 * A sheet's Activity: the last section, below comments or updates, collapsed
 * by default. The header shows the count ("Activity (12)", one cheap count
 * request); the feed mounts, and fetches its entries, only once opened, and
 * unmounts again when closed.
 */
export function SheetActivitySection({
  targetType,
  targetId = null,
  projectId = null,
  companyId = null,
  emptyState = 'No activity recorded yet.',
  className,
}: SheetActivitySectionProps) {
  const total = useActivityCount({ targetType, targetId, projectId, companyId })

  return (
    <SheetActivityDisclosure total={total} className={className}>
      <ActivityFeed
        className='pt-4'
        targetType={targetType}
        targetId={targetId}
        projectId={projectId}
        companyId={companyId}
        pageSize={20}
        emptyState={emptyState}
      />
    </SheetActivityDisclosure>
  )
}

/**
 * The collapsed shell on its own: the "Activity (n)" toggle and a region that
 * mounts its children only while open. `SheetActivitySection` fills it with
 * the feed; the /design specimen fills it with sample rows.
 */
export function SheetActivityDisclosure({
  total,
  className,
  children,
}: {
  /** Shown as "Activity (n)"; null shows "Activity" alone. */
  total: number | null
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const headingId = useId()

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<section className={cn('flex flex-col', className)} />}
    >
      <h3 className='text-sm font-semibold tracking-tight'>
        <CollapsibleTrigger
          id={headingId}
          className='hover:text-foreground/80 focus-visible:ring-ring/50 -mx-1 flex min-h-5 w-[calc(100%+0.5rem)] cursor-pointer items-center justify-between gap-2 rounded-sm px-1 text-left outline-none focus-visible:ring-[3px]'
        >
          <span>
            Activity
            {total !== null ? (
              <span className='text-muted-foreground font-normal'>
                {' '}
                ({total})
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
              open ? 'rotate-0' : '-rotate-90'
            )}
            aria-hidden='true'
          />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent role='region' aria-labelledby={headingId}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
