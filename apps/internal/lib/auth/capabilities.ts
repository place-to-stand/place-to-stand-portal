import type { Database } from '@/lib/supabase/types'

/**
 * The single list of what each role may do. Server guards, nav filtering,
 * dashboard widgets, the MCP server and the CLI all read from here, and
 * Settings → Roles & permissions renders it, so adding a capability (or
 * moving one between roles) happens in exactly one place.
 *
 * Client-safe on purpose: no server-only imports, so UI can ask the same
 * question the guards answer.
 *
 * Rules of thumb:
 * - Anything not listed is admin-only. New pages and routes start that way.
 * - "Scoped" capabilities still pass through a data rule (e.g. project
 *   membership in `lib/projects/access.ts`); the note says which.
 */
export type Role = Database['public']['Enums']['user_role']

export type CapabilitySurface = 'app' | 'mcp' | 'cli'

export type CapabilityArea =
  | 'Portal'
  | 'Dashboard'
  | 'Projects & tasks'
  | 'Sales'
  | 'Directory'
  | 'Billing & reports'
  | 'Settings'
  | 'Integrations'

type CapabilityDefinition = {
  area: CapabilityArea
  label: string
  /** Plain sentence for the Roles & permissions page. */
  description: string
  roles: readonly Role[]
  /** Where the capability is enforced. */
  surfaces: readonly CapabilitySurface[]
  /**
   * A data rule that narrows it further for a role, shown once per row as a
   * footnote on the permission's label.
   */
  scope?: Partial<Record<Role, CapabilityScope>>
}

const ADMIN_ONLY = ['ADMIN'] as const satisfies readonly Role[]
const STAFF = ['ADMIN', 'SALES'] as const satisfies readonly Role[]

export const CAPABILITIES = {
  // Portal
  'portal.sign_in': {
    area: 'Portal',
    label: 'Sign in to the internal portal',
    description: 'Client users are sent to the client portal instead.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'portal.command_palette': {
    area: 'Portal',
    label: 'Search everything (command palette)',
    description: 'Results are limited to what the role can open.',
    roles: STAFF,
    surfaces: ['app'],
  },

  // Dashboard
  'dashboard.home': {
    area: 'Dashboard',
    label: 'Home dashboard',
    description: 'Arrange, show and hide home widgets.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'widget.notifications': {
    area: 'Dashboard',
    label: 'My notifications widget',
    description: 'Assignments, comments and due dates, with read and clear.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'widget.my_tasks': {
    area: 'Dashboard',
    label: 'My tasks widget',
    description: 'Your open tasks, late and due-soon first.',
    roles: STAFF,
    surfaces: ['app'],
    scope: { SALES: { detail: 'Only projects they are a member of.' } },
  },
  'widget.pipeline': {
    area: 'Dashboard',
    label: 'Leads pipeline widget',
    description: 'Open leads per stage, yours and everyone’s.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'widget.quiet_leads': {
    area: 'Dashboard',
    label: 'My aging leads widget',
    description: 'Your open leads, longest since contact first.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'widget.hours': {
    area: 'Dashboard',
    label: 'Monthly hours widget',
    description: 'Logged hours across the agency for the month.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'widget.recent_activity': {
    area: 'Dashboard',
    label: 'Recent activity widget',
    description: 'AI summary of activity across every project.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },

  // Projects & tasks
  'projects.view_all': {
    area: 'Projects & tasks',
    label: 'See every project',
    description: 'Without this, only projects you are a member of.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'projects.view_member': {
    area: 'Projects & tasks',
    label: 'Work on member projects',
    description:
      'Create, edit and move tasks, comment and attach files, on projects you’re a member of and your personal boards.',
    roles: STAFF,
    surfaces: ['app'],
    scope: { SALES: { detail: 'Only projects they are a member of.' } },
  },
  'projects.create': {
    area: 'Projects & tasks',
    label: 'Create projects',
    description:
      'The project sheet only offers the project types and fields the role can use.',
    roles: STAFF,
    surfaces: ['app'],
    scope: { SALES: { detail: 'Only their own personal projects.' } },
  },
  'projects.manage': {
    area: 'Projects & tasks',
    label: 'Manage projects',
    description:
      'Edit any project and create any type; owners, members and integrations.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'projects.view_financials': {
    area: 'Projects & tasks',
    label: 'See project hours and billing',
    description:
      'Logged hours, billing terms, client notes, portal users, GitHub and integration links. Hidden from members.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'projects.admin_tabs': {
    area: 'Projects & tasks',
    label: 'Project admin tabs',
    description: 'Time logs, review, overview and planning.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'tasks.move_off_client_project': {
    area: 'Projects & tasks',
    label: 'Move a task off a client project',
    description: 'Members can only move tasks between projects they work on.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'tasks.edit_others_comments': {
    area: 'Projects & tasks',
    label: 'Edit or delete other users’ comments and files',
    description: 'Everyone can edit and delete their own.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },

  // Sales
  'leads.manage': {
    area: 'Sales',
    label: 'Manage leads',
    description: 'The leads board, lead sheet and lead activity.',
    roles: STAFF,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'leads.tasks': {
    area: 'Sales',
    label: 'Tasks on leads',
    description: 'Lead tasks live in the Sales project.',
    roles: STAFF,
    surfaces: ['app', 'mcp', 'cli'],
    scope: {
      SALES: { detail: 'Only if they are a member of the Sales project.' },
    },
  },
  'leads.convert': {
    area: 'Sales',
    label: 'Make a lead’s company a client',
    description: 'Creates the client and links the company.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'submissions.manage': {
    area: 'Sales',
    label: 'Website form submissions',
    description: 'Contact and audit form inbox.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },

  // Directory
  'companies.manage': {
    area: 'Directory',
    label: 'Manage companies',
    description: 'Companies, their people and leads.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'contacts.manage': {
    area: 'Directory',
    label: 'Manage people',
    description: 'People at companies, leads and clients.',
    roles: STAFF,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'clients.manage': {
    area: 'Directory',
    label: 'Manage clients',
    description: 'Clients, billing terms and portal users.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'activity.read_crm': {
    area: 'Directory',
    label: 'See CRM activity',
    description: 'History of leads, people and companies.',
    roles: STAFF,
    surfaces: ['app', 'mcp'],
  },
  'activity.read_all': {
    area: 'Directory',
    label: 'See all activity',
    description: 'Project, client and billing history.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },

  // Billing & reports
  'billing.manage': {
    area: 'Billing & reports',
    label: 'Manage billing',
    description: 'Invoices, hour blocks and time logs.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'reports.view': {
    area: 'Billing & reports',
    label: 'Reports and monthly close',
    description: 'Agency-wide numbers.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },

  // Settings
  'settings.users': {
    area: 'Settings',
    label: 'Manage users and roles',
    description: 'Invite, disable and change roles.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'settings.templates': {
    area: 'Settings',
    label: 'Email and notification templates',
    description: 'Preview everything the portal sends.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'settings.design': {
    area: 'Settings',
    label: 'Design system',
    description: 'Colours, components and patterns used across the portal.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'settings.permissions': {
    area: 'Settings',
    label: 'View roles & permissions',
    description: 'This page.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },

  // Integrations
  'integrations.mcp': {
    area: 'Integrations',
    label: 'Use the MCP connector',
    description:
      'Claude and other agents, with the same permissions as the portal. Tools a role can’t use are refused.',
    roles: STAFF,
    surfaces: ['mcp'],
  },
  'integrations.cli': {
    area: 'Integrations',
    label: 'Use the pts CLI',
    description: 'Command-line access for scripts and agents.',
    roles: ADMIN_ONLY,
    surfaces: ['cli'],
  },
  'integrations.manage': {
    area: 'Integrations',
    label: 'Connect Google, GitHub, Vercel and Supabase',
    description: 'Agency-wide integrations.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
} as const satisfies Record<string, CapabilityDefinition>

export type Capability = keyof typeof CAPABILITIES

export const CAPABILITY_AREAS: readonly CapabilityArea[] = [
  'Portal',
  'Dashboard',
  'Projects & tasks',
  'Sales',
  'Directory',
  'Billing & reports',
  'Settings',
  'Integrations',
]

/** Roles shown as columns on the permissions page (CLIENT never signs in here). */
export const PERMISSION_ROLES: readonly Role[] = ['ADMIN', 'SALES']

export function roleCan(
  role: Role | null | undefined,
  capability: Capability
): boolean {
  if (!role) return false
  return (CAPABILITIES[capability].roles as readonly Role[]).includes(role)
}

/** Every role that holds a capability, e.g. for "available to admin and sales". */
export function rolesWith(capability: Capability): readonly Role[] {
  return CAPABILITIES[capability].roles
}

/**
 * Project types a role may create from the project sheet. Full project
 * managers get every type; everyone else who can create projects gets
 * personal ones only.
 */
export function creatableProjectTypes<T extends string>(
  role: Role | null | undefined,
  allTypes: readonly T[]
): T[] {
  if (roleCan(role, 'projects.manage')) return [...allTypes]
  if (roleCan(role, 'projects.create')) {
    return allTypes.filter(type => type === 'PERSONAL')
  }
  return []
}

export type CapabilityScope = { detail: string }

export function capabilityScope(
  capability: Capability,
  role: Role
): CapabilityScope | undefined {
  const scope = (CAPABILITIES[capability] as CapabilityDefinition).scope
  return scope?.[role]
}
