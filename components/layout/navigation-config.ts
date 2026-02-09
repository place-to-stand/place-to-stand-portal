import type { LucideIcon } from 'lucide-react'
import {
  Clock3,
  Receipt,
  FolderKanban,
  Building2,
  Users,
  Home as HomeIcon,
  ListTodo,
  Handshake,
  Plug,
  Mail,
  Sparkles,
  Contact,
  FileText,
  ScrollText,
} from 'lucide-react'
import type { UserRole } from '@/lib/auth/session'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  matchHrefs?: string[]
}

export type NavGroup = {
  title?: string | null
  roles: UserRole[]
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Portal',
    roles: ['ADMIN', 'CLIENT'],
    items: [
      {
        href: '/my/home',
        label: 'Home',
        icon: HomeIcon,
      },
      {
        href: '/my/tasks/board',
        label: 'Tasks',
        icon: ListTodo,
        matchHrefs: ['/my/tasks', '/my/tasks/calendar'],
      },
      {
        href: '/my/inbox',
        label: 'Inbox',
        icon: Mail,
      },
      {
        href: '/my/suggestions',
        label: 'Suggestions',
        icon: Sparkles,
      },
    ],
  },
  {
    title: 'Sales',
    roles: ['ADMIN', 'CLIENT'],
    items: [
      {
        href: '/leads/board',
        label: 'Leads',
        icon: Handshake,
        matchHrefs: ['/leads'],
      },
      {
        href: '/proposals',
        label: 'Proposals',
        icon: ScrollText,
      },
      {
        href: '/invoices',
        label: 'Invoices',
        icon: Receipt,
        matchHrefs: ['/invoices'],
      },
    ],
  },
  {
    title: 'Work',
    roles: ['ADMIN', 'CLIENT'],
    items: [
      {
        href: '/projects',
        label: 'Projects',
        icon: FolderKanban,
      },
      {
        href: '/clients',
        label: 'Clients',
        icon: Building2,
      },
      {
        href: '/contacts',
        label: 'Contacts',
        icon: Contact,
      },
    ],
  },
  {
    title: 'Reports',
    roles: ['ADMIN'],
    items: [
      {
        href: '/reports/monthly-close',
        label: 'Monthly Close',
        icon: FileText,
        matchHrefs: ['/reports'],
      },
    ],
  },
  {
    title: 'Settings',
    roles: ['ADMIN'],
    items: [
      {
        href: '/settings/users',
        label: 'Users',
        icon: Users,
      },
      {
        href: '/settings/integrations',
        label: 'Integrations',
        icon: Plug,
      },
      {
        href: '/settings/templates',
        label: 'Templates',
        icon: FileText,
        matchHrefs: ['/settings/templates'],
      },
    ],
  },
]
