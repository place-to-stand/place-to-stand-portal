import type { TabsNavTab } from '@/components/layout/tabs-nav'

export const HOUR_BLOCKS_TABS = [
  { label: 'Hour blocks', value: 'hour-blocks', href: '/hour-blocks' },
  { label: 'Archive', value: 'archive', href: '/hour-blocks/archive' },
  { label: 'Activity', value: 'activity', href: '/hour-blocks/activity' },
] satisfies readonly TabsNavTab[]
