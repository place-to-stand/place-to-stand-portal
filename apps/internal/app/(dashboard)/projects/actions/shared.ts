'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateProjectTaskViews() {
  await Promise.all([
    revalidatePath('/my/home'),
    revalidatePath('/projects'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/tasks', 'page'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/activity', 'page'),
    revalidatePath('/projects/[clientSlug]/[projectSlug]/review', 'page'),
    revalidatePath('/my/tasks/board', 'page'),
    revalidatePath('/my/tasks/calendar', 'page'),
  ])
}
