import type { TabsNavTab } from '@/components/layout/tabs-nav'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'

/**
 * Admin → Settings: one sidebar entry, a tab per area. Every tab is
 * admin-only (the settings layout requires `portal.admin`, and each page
 * guards its own capability), so none is filtered by role.
 */
export const SETTINGS_TABS = [
  { label: 'Business', value: 'business', href: '/settings/business' },
  { label: 'Billing', value: 'billing', href: '/settings/billing' },
  {
    label: 'Integrations',
    value: 'integrations',
    href: '/settings/integrations',
  },
] satisfies readonly TabsNavTab[]

export type SettingsTab = (typeof SETTINGS_TABS)[number]['value']

/** "Admin / Settings / Billing": the nav entry, then the tab. */
export function settingsCrumbs(tab: SettingsTab) {
  const label = SETTINGS_TABS.find(item => item.value === tab)?.label ?? ''
  return [...crumbsForNav('/settings/business'), { label }]
}
