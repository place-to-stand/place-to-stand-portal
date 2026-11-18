import type { LucideIcon } from 'lucide-react'
import { LifeBuoy, Palette, ShieldCheck } from 'lucide-react'

import type { TabsNavTab } from '@/components/layout/tabs-nav'
import { roleCan, type Capability, type Role } from '@/lib/auth/capabilities'
import { ENTITY_ICONS } from '@/lib/entity-accents'
import type { Crumb } from '@/lib/navigation/breadcrumbs'

type HelpTabDefinition = TabsNavTab & {
  /** The capability the tab's page guards with; the strip hides the rest. */
  capability: Capability
  /** For the tab's command palette entry. */
  icon: LucideIcon
}

/**
 * Help, opened from the page header: a tab per reference page. Unlike
 * Settings, the tabs differ by role: everyone signed in gets Get help, and
 * each other tab shows only to roles its page lets in.
 */
export const HELP_TABS = [
  {
    label: 'Get help',
    value: 'get-help',
    icon: LifeBuoy,
    href: '/help',
    capability: 'portal.sign_in',
  },
  {
    label: 'Roles & permissions',
    value: 'permissions',
    icon: ShieldCheck,
    href: '/help/permissions',
    capability: 'settings.permissions',
  },
  {
    label: 'Emails',
    value: 'emails',
    icon: ENTITY_ICONS.template,
    href: '/help/templates/emails',
    capability: 'settings.templates',
  },
  {
    label: 'PDFs',
    value: 'pdfs',
    icon: ENTITY_ICONS.template,
    href: '/help/templates/pdfs',
    capability: 'settings.templates',
  },
  {
    label: 'Notifications',
    value: 'notifications',
    icon: ENTITY_ICONS.template,
    href: '/help/templates/notifications',
    capability: 'settings.templates',
  },
  {
    label: 'Design system',
    value: 'design-system',
    icon: Palette,
    href: '/help/design-system',
    capability: 'settings.design',
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
