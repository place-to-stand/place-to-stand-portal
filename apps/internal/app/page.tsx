import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/session'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function IndexPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  redirect('/my/home')
}
