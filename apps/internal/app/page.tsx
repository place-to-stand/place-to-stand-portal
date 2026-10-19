import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/session'
import { homePathForRole } from '@/lib/auth/roles'

export default async function IndexPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  redirect(homePathForRole(user.role))
}
