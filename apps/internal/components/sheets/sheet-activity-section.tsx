'use client'

import dynamic from 'next/dynamic'
import { type ReactNode } from 'react'
import { History } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@pts/ui/accordion'
import type { ActivityFeedProps } from '@/components/activity/activity-feed'
import { useActivityCount } from '@/lib/activity/use-activity-feed'

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
  // One item, closed by default; a closed panel unmounts, so the feed (and
  // its fetch) waits for the first open.
  return (
    <Accordion className={className}>
      <AccordionItem value='activity' className='border-b-0'>
        <AccordionTrigger className='py-0 text-sm font-semibold tracking-tight hover:no-underline'>
          <span className='flex items-center gap-2'>
            <History
              className='text-muted-foreground size-4 shrink-0'
              aria-hidden
            />
            Activity
            {total !== null ? (
              <span className='text-muted-foreground font-normal'>
                {' '}
                ({total})
              </span>
            ) : null}
          </span>
        </AccordionTrigger>
        <AccordionContent className='pb-0'>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
