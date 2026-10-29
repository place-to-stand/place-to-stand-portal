'use client'

import type { DashboardWidgetId } from '@/lib/dashboard/layout'

import { HoursWidget } from '../hours-widget'
import { MyTasksWidget } from '../my-tasks-widget'
import { NotificationsWidget } from '../notifications-widget'
import { RecentActivityOverviewWidget } from '../recent-activity-overview-widget'
import { PipelineWidget, QuietLeadsWidget } from '../sales-widgets'
import type { DashboardWidgetData } from './types'

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  notifications: 'Notifications',
  'my-tasks': 'My tasks',
  hours: 'Monthly hours snapshot',
  'recent-activity': 'Recent activity',
  'quiet-leads': 'Aging leads',
  pipeline: 'Leads pipeline',
}

type WidgetRendererProps = {
  id: DashboardWidgetId
  data: DashboardWidgetData
  className?: string
}

export function WidgetRenderer({ id, data, className }: WidgetRendererProps) {
  switch (id) {
    case 'notifications':
      return <NotificationsWidget className={className} />
    case 'my-tasks':
      return (
        <MyTasksWidget
          tasks={data.tasks ?? []}
          totalCount={data.totalTaskCount ?? 0}
          className={className}
        />
      )
    case 'hours':
      return data.initialHoursSnapshot ? (
        <HoursWidget
          initialSnapshot={data.initialHoursSnapshot}
          className={className}
        />
      ) : null
    case 'recent-activity':
      return <RecentActivityOverviewWidget className={className} />
    case 'quiet-leads':
      return data.sales ? (
        <QuietLeadsWidget data={data.sales} className={className} />
      ) : null
    case 'pipeline':
      return data.sales ? (
        <PipelineWidget data={data.sales} className={className} />
      ) : null
  }
}
