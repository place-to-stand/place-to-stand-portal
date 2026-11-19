import type { LucideIcon } from 'lucide-react'

import type { Capability } from '@/lib/auth/capabilities'
import {
  BookOpen,
  FileText,
  Home as HomeIcon,
  Settings as SettingsIcon,
} from 'lucide-react'
import { ENTITY_ICONS } from '@/lib/entity-accents'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  matchHrefs?: string[]
  /** Who sees the entry (`lib/auth/capabilities.ts`). */
  capability: Capability
}

export type NavGroup = {
  title?: string | null
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Portal',
    items: [
      {
        href: '/my/home',
        capability: 'dashboard.home',
        label: 'Home',
        icon: HomeIcon,
      },
      {
        href: '/my/tasks/board',
        capability: 'projects.view_member',
        label: 'Tasks',
        icon: ENTITY_ICONS.task,
        matchHrefs: ['/my/tasks', '/my/tasks/calendar'],
      },
    ],
  },
  {
    title: 'Sales',
    items: [
      {
        href: '/submissions',
        capability: 'submissions.manage',
        label: 'Submissions',
        icon: ENTITY_ICONS.submission,
        matchHrefs: ['/submissions'],
      },
      {
        href: '/leads',
        capability: 'leads.manage',
        label: 'Leads',
        icon: ENTITY_ICONS.lead,
      },
      {
        href: '/invoices',
        capability: 'billing.manage',
        label: 'Invoices',
        icon: ENTITY_ICONS.invoice,
        matchHrefs: ['/invoices'],
      },
      {
        href: '/hour-blocks',
        capability: 'billing.manage',
        label: 'Hour blocks',
        icon: ENTITY_ICONS.hourBlock,
      },
    ],
  },
  {
    title: 'Directory',
    items: [
      {
        href: '/companies',
        capability: 'companies.manage',
        label: 'Companies',
        icon: ENTITY_ICONS.company,
      },
      {
        href: '/people',
        capability: 'contacts.manage',
        label: 'People',
        icon: ENTITY_ICONS.contact,
      },
    ],
  },
  {
    title: 'Work',
    items: [
      {
        href: '/projects',
        capability: 'projects.view_member',
        label: 'Projects',
        icon: ENTITY_ICONS.project,
      },
      {
        href: '/time-logs',
        capability: 'billing.manage',
        label: 'Time logs',
        icon: ENTITY_ICONS.timeLog,
      },
    ],
  },
  {
    title: 'Reports',
    items: [
      {
        href: '/reports/monthly-close',
        capability: 'reports.view',
        label: 'Monthly close',
        icon: FileText,
        matchHrefs: ['/reports'],
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      {
        // Business, Billing and Integrations are tabs on one page.
        href: '/settings/business',
        capability: 'settings.business',
        label: 'Settings',
        icon: SettingsIcon,
        matchHrefs: [
          '/settings/business',
          '/settings/billing',
          '/settings/integrations',
        ],
      },
      {
        // One item for every reference page (tabs on the page), so the
        // sidebar doesn't grow with each new topic. Nothing there changes
        // the portal; it shows how it's set up and whether it's healthy.
        href: '/reference',
        capability: 'settings.permissions',
        label: 'Reference',
        icon: BookOpen,
      },
    ],
  },
]
