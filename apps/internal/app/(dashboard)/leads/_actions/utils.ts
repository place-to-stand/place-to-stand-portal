import { revalidatePath } from 'next/cache'

export function revalidateLeadsPath() {
  revalidatePath('/leads')
  revalidatePath('/leads/archive')
}
