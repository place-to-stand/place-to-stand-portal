import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const TIME_LOGS_TABS = [
  { label: 'Time logs', value: 'time-logs', href: '/time-logs' },
  { label: 'Archive', value: 'archive', href: '/time-logs/archive' },
  { label: 'Activity', value: 'activity', href: '/time-logs/activity' },
] satisfies readonly TabsNavTab[]
