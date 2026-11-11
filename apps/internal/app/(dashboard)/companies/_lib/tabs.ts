import type { TabsNavTab } from '@/components/layout/tabs-nav'

/** Companies, then Clients (the companies you bill), Archive and Activity. */
export const COMPANIES_TABS: TabsNavTab[] = [
  { label: 'Companies', value: 'companies', href: '/companies' },
  { label: 'Clients', value: 'clients', href: '/companies/clients' },
  { label: 'Archive', value: 'archive', href: '/companies/archive' },
  { label: 'Activity', value: 'activity', href: '/companies/activity' },
]
