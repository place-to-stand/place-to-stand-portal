import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const CONTACTS_TABS: TabsNavTab[] = [
  { label: 'People', value: 'contacts', href: '/people' },
  { label: 'Archive', value: 'archive', href: '/people/archive' },
  { label: 'Activity', value: 'activity', href: '/people/activity' },
]
