import { redirect } from 'next/navigation'

import { requireRole } from '@/lib/auth/session'

/** Users live on people now. */
export default async function UsersArchivePage() {
  await requireRole('ADMIN')
  redirect('/people')
}
