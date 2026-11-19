import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const TEMPLATES_TABS = [
  { label: 'Emails', value: 'emails', href: '/reference/templates/emails' },
  { label: 'PDFs', value: 'pdfs', href: '/reference/templates/pdfs' },
  {
    label: 'Notifications',
    value: 'notifications',
    href: '/reference/templates/notifications',
  },
] satisfies readonly TabsNavTab[]
