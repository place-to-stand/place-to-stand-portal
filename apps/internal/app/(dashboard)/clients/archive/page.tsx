import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth/session'

/** Clients that stopped billing are the Former clients filter on Companies. */
export default async function ClientsArchivePage() {
  await requireUser()
  redirect('/companies?type=former')
}
