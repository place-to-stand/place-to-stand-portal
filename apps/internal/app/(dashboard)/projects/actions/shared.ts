'use server'

import { revalidatePath } from 'next/cache'

import { requireStaffUser } from '@/lib/auth/session'

export async function revalidateProjectTaskViews() {
  // Exported from a server-action module, so callable from the browser:
  // only staff may trigger it.
  await requireStaffUser()
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
