import type { Capability } from '@/lib/auth/capabilities'

/**
 * The capability each MCP tool requires, by tool name. `defineTool` refuses a
 * call when the caller's role lacks it, and Settings → Roles & permissions
 * lists the tools under it, so the two can't drift. Client-safe.
 */
export const MCP_TOOL_CAPABILITIES = {
  whoami: 'integrations.mcp',
  list_users: 'integrations.mcp',
  list_leads: 'leads.manage',
  get_lead: 'leads.manage',
  create_lead: 'leads.manage',
  update_lead: 'leads.manage',
  add_lead_update: 'leads.manage',
  list_contacts: 'contacts.manage',
  get_contact: 'contacts.manage',
  list_activity: 'activity.read_crm',
  recent_activity: 'activity.read_crm',
  list_clients: 'clients.manage',
  get_client: 'clients.manage',
  list_projects: 'projects.view_all',
  get_project: 'projects.view_all',
  list_tasks: 'projects.view_all',
  get_task: 'projects.view_all',
  create_task: 'projects.view_all',
  update_task: 'projects.view_all',
  add_task_comment: 'projects.view_all',
  list_invoices: 'billing.manage',
  get_invoice: 'billing.manage',
  list_hour_blocks: 'billing.manage',
  get_client_hour_balance: 'billing.manage',
  get_monthly_close: 'billing.manage',
  list_time_logs: 'billing.manage',
} as const satisfies Record<string, Capability>

export type McpToolName = keyof typeof MCP_TOOL_CAPABILITIES
