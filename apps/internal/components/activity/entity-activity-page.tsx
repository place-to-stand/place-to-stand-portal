import type { ComponentProps, ReactNode } from 'react'

import { ActivitySection } from '@/components/activity/activity-section'
import { PagePanel } from '@/components/layout/page-panel'
import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

type EntityActivityPageProps = {
  /** The list page's nav href, for the breadcrumbs ("/invoices"). */
  navHref: string
  tabs: ComponentProps<typeof PageShell>['tabs']
  primaryAction?: ReactNode
  targetType: ComponentProps<typeof ActivitySection>['targetType']
  emptyState: string
  description: string
}

/**
 * The Activity tab of a list page: the entity's tabs and create button over
 * its activity feed. The page itself checks access and loads the button.
 */
export function EntityActivityPage({
  navHref,
  tabs,
  primaryAction,
  targetType,
  emptyState,
  description,
}: EntityActivityPageProps) {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav(navHref), { label: 'Activity' }]}
      tabs={tabs}
      activeTab='activity'
      primaryAction={primaryAction}
    >
      <PagePanel>
        <ActivitySection
          targetType={targetType}
          emptyState={emptyState}
          description={description}
        />
      </PagePanel>
    </PageShell>
  )
}
