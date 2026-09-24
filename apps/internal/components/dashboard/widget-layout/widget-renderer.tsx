'use client'

import type { DashboardWidgetId } from '@/lib/dashboard/layout'

import { HoursWidget } from '../hours-widget'
import { MyTasksWidget } from '../my-tasks-widget'
import { RecentActivityOverviewWidget } from '../recent-activity-overview-widget'
import type { DashboardWidgetData } from './types'

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  'my-tasks': 'My tasks',
  hours: 'Monthly hours snapshot',
  'recent-activity': 'Recent activity',
}

type WidgetRendererProps = {
  id: DashboardWidgetId
  data: DashboardWidgetData
  className?: string
}

export function WidgetRenderer({ id, data, className }: WidgetRendererProps) {
  switch (id) {
    case 'my-tasks':
      return (
        <MyTasksWidget
          tasks={data.tasks}
          totalCount={data.totalTaskCount}
          className={className}
        />
      )
    case 'hours':
      return (
        <HoursWidget
          initialSnapshot={data.initialHoursSnapshot}
          className={className}
        />
      )
    case 'recent-activity':
      return <RecentActivityOverviewWidget className={className} />
  }
}
