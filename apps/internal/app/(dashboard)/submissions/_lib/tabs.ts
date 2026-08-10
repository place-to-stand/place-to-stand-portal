import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const SUBMISSIONS_TABS = [
  { label: 'Submissions', value: 'submissions', href: '/submissions' },
  { label: 'Archive', value: 'archive', href: '/submissions/archive' },
  { label: 'Activity', value: 'activity', href: '/submissions/activity' },
] satisfies readonly TabsNavTab[]
