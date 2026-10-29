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
  /** A data rule that narrows it further, shown next to the role. */
  scope?: Partial<Record<Role, string>>
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
    description: 'Results are limited to records the role can open.',
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
    label: 'Notifications widget',
    description: 'Your notification stream with read/unread and clear.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'widget.my_tasks': {
    area: 'Dashboard',
    label: 'My tasks widget',
    description: 'Open tasks assigned to you.',
    roles: STAFF,
    surfaces: ['app'],
    scope: { SALES: 'Only projects they are a member of' },
  },
  'widget.next_steps': {
    area: 'Dashboard',
    label: 'Next steps widget',
    description: 'Your open tasks, late and due-soon first.',
    roles: STAFF,
    surfaces: ['app'],
    scope: { SALES: 'Only projects they are a member of' },
  },
  'widget.pipeline': {
    area: 'Dashboard',
    label: 'Pipeline widget',
    description: 'Open leads per stage, yours and everyone’s.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'widget.quiet_leads': {
    area: 'Dashboard',
    label: 'Leads gone quiet widget',
    description: 'Your open leads, longest without a touch first.',
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
    label: 'Work the task board of member projects',
    description:
      'Create, edit and move tasks; comment and attach files on projects you are added to, plus your own personal boards.',
    roles: STAFF,
    surfaces: ['app'],
    scope: { SALES: 'Only projects they are a member of' },
  },
  'projects.create': {
    area: 'Projects & tasks',
    label: 'Create projects',
    description:
      'The project sheet only offers the project types and fields the role can use.',
    roles: STAFF,
    surfaces: ['app'],
    scope: { SALES: 'Personal projects only' },
  },
  'projects.manage': {
    area: 'Projects & tasks',
    label: 'Edit projects, any project type, manage members',
    description:
      'Client and internal projects, owners, members and integrations.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'projects.view_financials': {
    area: 'Projects & tasks',
    label: 'See hours, billing and client notes on projects',
    description:
      'Logged hours, billing terms, client notes, portal members, GitHub and integration links. Hidden from members.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'projects.admin_tabs': {
    area: 'Projects & tasks',
    label: 'Time logs, review, overview and planning tabs',
    description: 'The project tabs beyond the task board.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'tasks.move_off_client_project': {
    area: 'Projects & tasks',
    label: 'Move a task off a client project',
    description: 'Members can move tasks only between projects they work.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },
  'tasks.edit_others_comments': {
    area: 'Projects & tasks',
    label: 'Edit or delete other people’s comments and files',
    description: 'Everyone can edit and delete their own.',
    roles: ADMIN_ONLY,
    surfaces: ['app'],
  },

  // Sales
  'leads.manage': {
    area: 'Sales',
    label: 'Leads: view, create, edit, move stages',
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
    scope: { SALES: 'Must be a member of the Sales project' },
  },
  'leads.convert': {
    area: 'Sales',
    label: 'Convert a lead to a client',
    description: 'Creates the client and links the company.',
    roles: STAFF,
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
    label: 'Companies: view, create, edit, archive',
    description: 'Company records, their people and leads.',
    roles: STAFF,
    surfaces: ['app'],
  },
  'contacts.manage': {
    area: 'Directory',
    label: 'Contacts: view, create, edit, archive',
    description: 'People at companies, leads and clients.',
    roles: STAFF,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'clients.manage': {
    area: 'Directory',
    label: 'Clients: view, create, edit',
    description: 'Client records, billing terms and portal members.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },
  'activity.read_crm': {
    area: 'Directory',
    label: 'Read lead, contact and company activity',
    description: 'History on the CRM records.',
    roles: STAFF,
    surfaces: ['app', 'mcp'],
  },
  'activity.read_all': {
    area: 'Directory',
    label: 'Read all activity',
    description: 'Project, client and billing history.',
    roles: ADMIN_ONLY,
    surfaces: ['app', 'mcp', 'cli'],
  },

  // Billing & reports
  'billing.manage': {
    area: 'Billing & reports',
    label: 'Invoices, hour blocks and time logs',
    description: 'Everything that touches money or billable hours.',
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
    description: 'Previews of everything the portal sends.',
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

export function capabilityScope(
  capability: Capability,
  role: Role
): string | undefined {
  const scope = (CAPABILITIES[capability] as CapabilityDefinition).scope
  return scope?.[role]
}
