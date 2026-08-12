'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateProjectTaskViews() {
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
