import type { TabsNavTab } from '@/components/layout/tabs-nav'

/**
 * All companies, then Clients: the same list preset to the companies you
 * bill (`?type=client`, the Client filter), Shopify-style.
 */
export const COMPANIES_TABS: TabsNavTab[] = [
  { label: 'All', value: 'companies', href: '/companies' },
  { label: 'Clients', value: 'clients', href: '/companies?type=client' },
  { label: 'Archive', value: 'archive', href: '/companies/archive' },
  { label: 'Activity', value: 'activity', href: '/companies/activity' },
]
