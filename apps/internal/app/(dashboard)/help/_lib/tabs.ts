import type { TabsNavTab } from '@/components/layout/tabs-nav'
import { roleCan, type Capability, type Role } from '@/lib/auth/capabilities'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

type HelpTabDefinition = TabsNavTab & {
  /** The capability the tab's page guards with; the strip hides the rest. */
  capability: Capability
}

/**
 * Portal → Help: one sidebar entry, a tab per reference page. Unlike
 * Settings, the tabs differ by role: everyone signed in gets Get help, and
 * each other tab shows only to roles its page lets in.
 */
const HELP_TABS = [
  {
    label: 'Get help',
    value: 'get-help',
    href: '/help',
    capability: 'portal.sign_in',
  },
  {
    label: 'Roles & permissions',
    value: 'permissions',
    href: '/help/permissions',
    capability: 'settings.permissions',
  },
  {
    label: 'Emails',
    value: 'emails',
    href: '/help/templates/emails',
    capability: 'settings.templates',
  },
  {
    label: 'PDFs',
    value: 'pdfs',
    href: '/help/templates/pdfs',
    capability: 'settings.templates',
  },
  {
    label: 'Notifications',
    value: 'notifications',
    href: '/help/templates/notifications',
    capability: 'settings.templates',
  },
  {
    label: 'Design system',
    value: 'design-system',
    href: '/help/design-system',
    capability: 'settings.design',
  },
] as const satisfies readonly HelpTabDefinition[]

export type HelpTab = (typeof HELP_TABS)[number]['value']

/** The tabs this role may open, in strip order. */
export function helpTabsFor(role: Role): TabsNavTab[] {
  return HELP_TABS.filter(tab => roleCan(role, tab.capability)).map(
    ({ label, value, href }) => ({ label, value, href })
  )
}

/** "Portal / Help / Emails": the nav entry, then the tab. */
export function helpCrumbs(tab: HelpTab) {
  const label = HELP_TABS.find(item => item.value === tab)?.label ?? ''
  return [...crumbsForNav('/help'), { label }]
}
