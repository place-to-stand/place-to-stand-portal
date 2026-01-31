import { revalidatePath } from 'next/cache'

export function revalidateLeadsPath() {
  revalidatePath('/leads/board')
}
