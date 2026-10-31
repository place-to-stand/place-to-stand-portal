import { and, eq, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { UUID_PATTERN } from '@/lib/sheets/entities'

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

/**
 * A user is a person's sign-in, so Users is People filtered to sign-ins, and
 * a sign-in is managed on the person's sheet. Old links keep working:
 * `?user=<id>` opens that person, `?user=new` the create-person sheet.
 */
export default async function UsersSettingsPage({
  searchParams,
}: PageProps<'/settings/users'>) {
  await requireRole('ADMIN')
  const params = await searchParams
  const next = new URLSearchParams({ signIn: 'any' })
  const userParam = firstParam(params.user)

  if (userParam === 'new') {
    redirect('/people?contact=new')
  }
  if (userParam && UUID_PATTERN.test(userParam)) {
    const [person] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.userId, userParam), isNull(contacts.deletedAt)))
      .limit(1)
    if (person) next.set('contact', person.id)
  }

  redirect(`/people?${next.toString()}`)
}
