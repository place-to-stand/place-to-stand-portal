import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const INVOICES_TABS = [
  { label: 'Invoices', value: 'invoices', href: '/invoices' },
  { label: 'Settings', value: 'settings', href: '/invoices/settings' },
  { label: 'Archive', value: 'archive', href: '/invoices/archive' },
  { label: 'Activity', value: 'activity', href: '/invoices/activity' },
] satisfies readonly TabsNavTab[]
