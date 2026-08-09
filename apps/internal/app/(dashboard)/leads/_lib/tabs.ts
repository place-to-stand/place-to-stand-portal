import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const LEADS_TABS: TabsNavTab[] = [
  { label: 'Leads', value: 'board', href: '/leads' },
  { label: 'Archive', value: 'archive', href: '/leads/archive' },
  { label: 'Activity', value: 'activity', href: '/leads/activity' },
]
