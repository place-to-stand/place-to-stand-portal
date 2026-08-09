import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const CONTACTS_TABS: TabsNavTab[] = [
  { label: 'Contacts', value: 'contacts', href: '/contacts' },
  { label: 'Archive', value: 'archive', href: '/contacts/archive' },
  { label: 'Activity', value: 'activity', href: '/contacts/activity' },
]
