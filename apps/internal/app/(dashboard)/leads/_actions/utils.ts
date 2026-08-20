import { revalidatePath } from 'next/cache'

export function revalidateLeadsPath() {
  revalidatePath('/leads')
  revalidatePath('/leads/archive')
  // Every lead action writes an activity event, so the activity tab was showing
  // stale data after each one — not just after logging an update (W13).
  revalidatePath('/leads/activity')
}
