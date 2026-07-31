import type { LucideIcon } from 'lucide-react'
import {
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
  Palette,
} from 'lucide-react'
import type { UserRole } from '@/lib/auth/session'

/**
 * Canvas Playground — collaborative workspace with Claude. Lives on its own
 * domain with its own Google-scoped auth and deployment pipeline; the portal
 * only links out to it.
 */
export const CANVAS_PLAYGROUND_URL = 'https://canvas-playground-orpin.vercel.app/'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  matchHrefs?: string[]
  /** Render as an <a target="_blank"> instead of a Next.js <Link>. */
  external?: boolean
  /** Restrict this item further than its group's roles. Defaults to the group's roles. */
  roles?: UserRole[]
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
        href: CANVAS_PLAYGROUND_URL,
        label: 'Canvas',
        icon: Palette,
        external: true,
        roles: ['ADMIN'],
      },
    ],
  },
  {
    title: 'Sales',
    roles: ['ADMIN', 'CLIENT'],
    items: [
      {
        href: '/submissions',
        label: 'Submissions',
        icon: Inbox,
        matchHrefs: ['/submissions'],
      },
      {
        href: '/leads/board',
        label: 'Leads',
        icon: Handshake,
        matchHrefs: ['/leads'],
      },
      {
        href: '/invoices',
        label: 'Invoices',
        icon: Receipt,
        matchHrefs: ['/invoices'],
      },
      {
        href: '/hour-blocks',
        label: 'Hour Blocks',
        icon: Clock3,
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
    ],
  },
]
