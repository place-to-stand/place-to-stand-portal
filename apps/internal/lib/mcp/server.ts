import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'

import { registerActivityTools } from './tools/activity'
import { registerBillingTools } from './tools/billing'
import { registerDirectoryTools } from './tools/directory'
import { registerLeadTools } from './tools/leads'
import { registerTaskTools } from './tools/tasks'
import { registerTimeLogTools } from './tools/time-logs'

/**
 * The tool registry (PRD 009 §4). Time logs, invoices, hour blocks and the
 * monthly close are read-only: logging hours stays a manual human process
 * (D5), and billing is readable but never written (D9).
 */
export function registerMcpTools(server: McpServer) {
  registerDirectoryTools(server)
  registerTaskTools(server)
  registerLeadTools(server)
  registerActivityTools(server)
  registerTimeLogTools(server)
  registerBillingTools(server)
}
