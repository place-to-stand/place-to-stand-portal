import { revalidatePath } from 'next/cache'

export function revalidateLeadsPath() {
  revalidatePath('/leads')
  revalidatePath('/leads/archive')
  // Every lead action writes an activity event, so the activity tab refreshes
  // too.
  revalidatePath('/leads/activity')
}
