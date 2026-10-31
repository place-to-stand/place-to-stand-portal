import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth/session'

/**
 * Clients are companies you bill, so the list is Companies filtered to
 * clients. Old links keep working: `?client=<id>` opens that client's
 * company sheet.
 */
export default async function ClientsPage({
  searchParams,
}: PageProps<'/clients'>) {
  await requireUser()
  const params = await searchParams
  const next = new URLSearchParams({ type: 'client' })
  for (const key of ['client', 'search']) {
    const value = params[key]
    const first = Array.isArray(value) ? value[0] : value
    if (first) next.set(key === 'search' ? 'q' : key, first)
  }
  redirect(`/companies?${next.toString()}`)
}
