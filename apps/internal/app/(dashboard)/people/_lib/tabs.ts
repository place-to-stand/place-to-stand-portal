import type { TabsNavTab } from '@/components/layout/tabs-nav'

import { roleCan } from '@/lib/auth/capabilities'
import type { AppUser } from '@/lib/auth/session'

const PEOPLE_TAB: TabsNavTab = {
  label: 'People',
  value: 'people',
  href: '/people',
}
/** Users, people who can sign in. For those who manage sign-ins. */
const USERS_TAB: TabsNavTab = {
  label: 'Users',
  value: 'users',
  href: '/people/users',
}
const REST: TabsNavTab[] = [
  { label: 'Archive', value: 'archive', href: '/people/archive' },
  { label: 'Activity', value: 'activity', href: '/people/activity' },
]

/** The People tabs this viewer gets. */
export function peopleTabs(role: AppUser['role']): TabsNavTab[] {
  return roleCan(role, 'settings.users')
    ? [PEOPLE_TAB, USERS_TAB, ...REST]
    : [PEOPLE_TAB, ...REST]
}
