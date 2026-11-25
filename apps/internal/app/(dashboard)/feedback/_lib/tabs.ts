import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const FEEDBACK_TABS = [
  { label: 'Feedback', value: 'feedback', href: '/feedback' },
  { label: 'Archive', value: 'archive', href: '/feedback/archive' },
] satisfies readonly TabsNavTab[]
