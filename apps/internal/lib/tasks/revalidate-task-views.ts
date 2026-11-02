import 'server-only'

import { revalidatePath } from 'next/cache'

/**
 * Refresh every page that shows tasks. No session check: callers have
 * already authorised the write (a server action, the CLI or MCP), and token
 * requests have no cookie session to check.
 */
export async function revalidateTaskViews() {
  await Promise.all([
    revalidatePath('/my/home'),
    revalidatePath('/projects'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/tasks', 'page'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/activity', 'page'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/review', 'page'),
    // Route id, not a concrete path: both views share `/my/tasks/[view]`.
    revalidatePath('/my/tasks/[view]', 'page'),
  ])
}
