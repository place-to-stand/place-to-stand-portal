// Plain server helpers, not server actions: as a 'use server' module these
// were callable by anyone as unauthenticated revalidation endpoints.
import 'server-only'

import { revalidatePath } from 'next/cache'

export async function revalidateProjectSettings() {
  revalidatePath('/projects')
  revalidatePath('/projects/archive')
  revalidatePath('/projects/activity')
}

export async function revalidateProjectDetailRoutes() {
  revalidatePath('/projects')
  revalidatePath('/projects/[clientSlug]/[projectSlug]/tasks')
}
