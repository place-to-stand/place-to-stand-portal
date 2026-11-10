import type { McpCapability } from '@/lib/auth/capabilities'

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
  list_submissions: 'submissions.manage',
  get_submission: 'submissions.manage',
  list_contacts: 'contacts.manage',
  get_contact: 'contacts.manage',
  create_person: 'contacts.manage',
  update_person: 'contacts.manage',
  list_companies: 'companies.manage',
  get_company: 'companies.manage',
  list_company_tags: 'companies.manage',
  create_company: 'companies.manage',
  update_company: 'companies.manage',
  list_activity: 'activity.read_crm',
  recent_activity: 'activity.read_crm',
  list_clients: 'clients.manage',
  get_client: 'clients.manage',
  list_projects: 'projects.view_all',
  get_project: 'projects.view_all',
  list_tasks: 'projects.view_member',
  get_task: 'projects.view_member',
  create_task: 'projects.view_member',
  update_task: 'projects.view_member',
  add_task_comment: 'projects.view_member',
  list_invoices: 'billing.manage',
  get_invoice: 'billing.manage',
  list_hour_blocks: 'billing.manage',
  get_client_hour_balance: 'billing.manage',
  get_monthly_close: 'billing.manage',
  get_company_billing: 'clients.manage',
  list_time_logs: 'billing.manage',
  archive_lead: 'leads.manage',
  restore_lead: 'leads.manage',
  archive_task: 'projects.view_member',
  // Admin-only inside the tool (the board's Review tab is admin-only).
  restore_task: 'projects.view_member',
  archive_company: 'companies.manage',
  restore_company: 'companies.manage',
  archive_person: 'contacts.manage',
  restore_person: 'contacts.manage',
} as const satisfies Record<string, McpCapability>

export type McpToolName = keyof typeof MCP_TOOL_CAPABILITIES
