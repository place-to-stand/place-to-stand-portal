import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth/session'

/** Client activity is company activity now. */
export default async function ClientsActivityPage() {
  await requireUser()
  redirect('/companies/activity')
}
