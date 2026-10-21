import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'

import { registerDirectoryTools } from './tools/directory'
import { registerLeadTools } from './tools/leads'
import { registerTaskTools } from './tools/tasks'

/** The tool registry (PRD 009 §4). Time logs are deliberately absent (D5). */
export function registerMcpTools(server: McpServer) {
  registerDirectoryTools(server)
  registerTaskTools(server)
  registerLeadTools(server)
}
