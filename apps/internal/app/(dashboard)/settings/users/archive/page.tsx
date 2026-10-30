import { redirect } from 'next/navigation'

import { requireRole } from '@/lib/auth/session'

/** Sign-ins live on people now: archived ones are people who can't sign in. */
export default async function UsersArchivePage() {
  await requireRole('ADMIN')
  redirect('/people?signIn=any')
}
