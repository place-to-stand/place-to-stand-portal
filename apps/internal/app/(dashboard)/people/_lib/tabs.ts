import type { TabsNavTab } from '@/components/layout/tabs-nav'

import { roleCan } from '@/lib/auth/capabilities'
import type { AppUser } from '@/lib/auth/session'

const ALL_TAB: TabsNavTab = { label: 'All', value: 'contacts', href: '/people' }
/**
 * People who can sign in: the same list preset to anyone with a live
 * sign-in (`?role=any`), Shopify-style. For those who manage sign-ins.
 */
const SIGN_INS_TAB: TabsNavTab = {
  label: 'Can sign in',
  value: 'sign-ins',
  href: '/people?role=any',
}
const REST: TabsNavTab[] = [
  { label: 'Archive', value: 'archive', href: '/people/archive' },
  { label: 'Activity', value: 'activity', href: '/people/activity' },
]

/** The People tabs this viewer gets. */
export function peopleTabs(role: AppUser['role']): TabsNavTab[] {
  return roleCan(role, 'settings.users')
    ? [ALL_TAB, SIGN_INS_TAB, ...REST]
    : [ALL_TAB, ...REST]
}
