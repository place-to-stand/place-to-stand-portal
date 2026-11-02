'use server'

import { requireStaffUser } from '@/lib/auth/session'
import { revalidateTaskViews } from '@/lib/tasks/revalidate-task-views'

/**
 * Exported from a server-action module, so callable from the browser: only
 * staff may trigger it. Code outside a browser request (CLI, MCP) must call
 * `revalidateTaskViews` instead: this guard needs a cookie session.
 */
export async function revalidateProjectTaskViews() {
  await requireStaffUser()
  revalidateTaskViews()
}
