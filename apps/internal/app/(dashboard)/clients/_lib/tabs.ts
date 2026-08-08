import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const CLIENTS_TABS: TabsNavTab[] = [
  { label: 'All Clients', value: 'clients', href: '/clients' },
  { label: 'Archive', value: 'archive', href: '/clients/archive' },
  { label: 'Activity', value: 'activity', href: '/clients/activity' },
]
