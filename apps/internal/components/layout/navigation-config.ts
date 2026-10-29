import type { LucideIcon } from 'lucide-react'

import type { Capability } from '@/lib/auth/capabilities'
import {
  Clock,
  Clock3,
  FolderKanban,
  Building2,
  Users,
  Home as HomeIcon,
  ListTodo,
  Handshake,
  Plug,
  Contact,
  FileText,
  Receipt,
  Inbox,
  Mail,
  Briefcase,
  ShieldCheck,
} from 'lucide-react'

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
        icon: ListTodo,
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
        icon: Inbox,
        matchHrefs: ['/submissions'],
      },
      {
        href: '/leads',
        capability: 'leads.manage',
        label: 'Leads',
        icon: Handshake,
      },
      {
        href: '/invoices',
        capability: 'billing.manage',
        label: 'Invoices',
        icon: Receipt,
        matchHrefs: ['/invoices'],
      },
      {
        href: '/hour-blocks',
        capability: 'billing.manage',
        label: 'Hour blocks',
        icon: Clock3,
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
        icon: FolderKanban,
      },
      {
        href: '/clients',
        capability: 'clients.manage',
        label: 'Clients',
        icon: Building2,
      },
      {
        href: '/time-logs',
        capability: 'billing.manage',
        label: 'Time logs',
        icon: Clock,
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
        icon: Briefcase,
      },
      {
        href: '/contacts',
        capability: 'contacts.manage',
        label: 'Contacts',
        icon: Contact,
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
    title: 'Settings',
    items: [
      {
        href: '/settings/users',
        capability: 'settings.users',
        label: 'Users',
        icon: Users,
      },
      {
        href: '/settings/permissions',
        capability: 'settings.permissions',
        label: 'Roles & permissions',
        icon: ShieldCheck,
      },
      {
        href: '/settings/integrations',
        capability: 'integrations.manage',
        label: 'Integrations',
        icon: Plug,
      },
      {
        href: '/settings/templates/emails',
        capability: 'settings.templates',
        label: 'Templates',
        icon: Mail,
        matchHrefs: ['/settings/templates'],
      },
    ],
  },
]
