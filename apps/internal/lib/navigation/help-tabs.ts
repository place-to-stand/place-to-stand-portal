import type { LucideIcon } from 'lucide-react'
import { LifeBuoy } from 'lucide-react'

import type { TabsNavTab } from '@/components/layout/tabs-nav'
import { roleCan, type Capability, type Role } from '@/lib/auth/capabilities'
import type { Crumb } from '@/lib/navigation/breadcrumbs'

type HelpTabDefinition = TabsNavTab & {
  /** The capability the tab's page guards with; the strip hides the rest. */
  capability: Capability
  /** For the tab's command palette entry. */
  icon: LucideIcon
}

/**
 * Help, opened from the page header: getting help from the people who built
 * the portal (What's new and Feedback join later). Each tab names the
 * capability its page guards with, so the strip shows a role only its own.
 * How the portal is set up lives in the sidebar's Reference group instead.
 */
export const HELP_TABS = [
  {
    label: 'Get help',
    value: 'get-help',
    icon: LifeBuoy,
    href: '/help',
    capability: 'portal.sign_in',
  },
] as const satisfies readonly HelpTabDefinition[]

export type HelpTab = (typeof HELP_TABS)[number]['value']

/** The tabs this role may open, in strip order, with their icons. */
export function helpTabEntriesFor(role: Role) {
  return HELP_TABS.filter(tab => roleCan(role, tab.capability))
}

/** The tab strip for this role. */
export function helpTabsFor(role: Role): TabsNavTab[] {
  return helpTabEntriesFor(role).map(({ label, value, href }) => ({
    label,
    value,
    href,
  }))
}

/** "Help / Emails": Help, then the tab. */
export function helpCrumbs(tab: HelpTab): Crumb[] {
  const label = HELP_TABS.find(item => item.value === tab)?.label ?? ''
  return [{ label: 'Help', href: '/help' }, { label }]
}
