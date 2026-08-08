import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const USERS_TABS = [
  { label: 'Users', value: 'users', href: '/settings/users' },
  { label: 'Archive', value: 'archive', href: '/settings/users/archive' },
  { label: 'Activity', value: 'activity', href: '/settings/users/activity' },
] satisfies readonly TabsNavTab[]
