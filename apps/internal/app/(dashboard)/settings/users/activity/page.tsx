import { redirect } from 'next/navigation'

import { requireRole } from '@/lib/auth/session'

/** Sign-in activity is people activity now. */
export default async function UsersActivityPage() {
  await requireRole('ADMIN')
  redirect('/people/activity')
}
