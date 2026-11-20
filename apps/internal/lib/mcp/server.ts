import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'

import { registerActivityTools } from './tools/activity'
import { registerArchiveTools } from './tools/archive'
import { registerBillingTools } from './tools/billing'
import { registerCompanyTools } from './tools/companies'
import { registerDirectoryTools } from './tools/directory'
import { registerLeadTools } from './tools/leads'
import { registerSubmissionTools } from './tools/submissions'
import { registerTaskTools } from './tools/tasks'
import { registerTimeLogTools } from './tools/time-logs'

/**
 * The tool registry. Time logs, invoices, hour blocks, billing history, form
 * submissions and the monthly close are read-only: logging hours stays a
 * manual human step, and billing is readable but never written.
 */
export function registerMcpTools(server: McpServer) {
  registerDirectoryTools(server)
  registerCompanyTools(server)
  registerTaskTools(server)
  registerLeadTools(server)
  registerSubmissionTools(server)
  registerActivityTools(server)
  registerTimeLogTools(server)
  registerBillingTools(server)
  registerArchiveTools(server)
}
