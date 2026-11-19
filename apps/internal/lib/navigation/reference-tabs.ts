import type { TabsNavTab } from '@/components/layout/tabs-nav'
import { roleCan, type Capability, type Role } from '@/lib/auth/capabilities'
import type { Crumb } from '@/lib/navigation/breadcrumbs'

type ReferenceTabDefinition = TabsNavTab & { capability: Capability }

/**
 * Admin → Reference: one sidebar item, one tab per topic. A new topic is a
 * tab here, never a new sidebar item. Each tab is shown only to roles with
 * its capability; the page itself checks the same one.
 */
export const REFERENCE_TABS = [
  {
    label: 'Roles & permissions',
    value: 'permissions',
    href: '/reference/permissions',
    capability: 'settings.permissions',
  },
  {
    label: 'Notifications',
    value: 'notifications',
    href: '/reference/notifications',
    capability: 'settings.templates',
  },
  {
    label: 'Templates',
    value: 'templates',
    href: '/reference/templates/emails',
    capability: 'settings.templates',
  },
  {
    label: 'Design system',
    value: 'design-system',
    href: '/reference/design-system',
    capability: 'settings.design',
  },
  {
    label: 'System health',
    value: 'health',
    href: '/reference/health',
    capability: 'settings.health',
  },
] as const satisfies readonly ReferenceTabDefinition[]

export type ReferenceTab = (typeof REFERENCE_TABS)[number]['value']

export function referenceTabsFor(role: Role): TabsNavTab[] {
  return REFERENCE_TABS.filter(tab => roleCan(role, tab.capability)).map(
    ({ label, value, href }) => ({ label, value, href })
  )
}

/** "Admin / Reference / <tab>". */
export function referenceCrumbs(tab: ReferenceTab): Crumb[] {
  const label = REFERENCE_TABS.find(item => item.value === tab)?.label ?? ''
  return [
    { label: 'Admin' },
    { label: 'Reference', href: '/reference' },
    { label },
  ]
}
