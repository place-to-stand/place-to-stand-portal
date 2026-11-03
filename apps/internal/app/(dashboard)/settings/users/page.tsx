import { redirect } from 'next/navigation'

import { requirePage } from '@/lib/auth/session'
import { findContactIdForUser } from '@/lib/queries/contacts/by-user'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { firstParam } from '@/lib/pagination/params'

/**
 * A user is a person's sign-in, so Users is People filtered to sign-ins, and
 * a sign-in is managed on the person's sheet. Old links keep working:
 * `?user=<id>` opens that person, `?user=new` the create-person sheet.
 */
export default async function UsersSettingsPage({
  searchParams,
}: PageProps<'/settings/users'>) {
  await requirePage('settings.users')
  const params = await searchParams
  const next = new URLSearchParams({ signIn: 'any' })
  const userParam = firstParam(params.user)

  if (userParam === 'new') {
    redirect('/people?contact=new')
  }
  if (userParam && UUID_PATTERN.test(userParam)) {
    const personId = await findContactIdForUser(userParam)
    // eslint-disable-next-line pts/sheet-url-through-builders -- a redirect that keeps the signIn filter beside the sheet param
    if (personId) next.set('contact', personId)
  }

  redirect(`/people?${next.toString()}`)
}
