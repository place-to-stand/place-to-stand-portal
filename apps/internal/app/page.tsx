import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/session'

// Redirect-only route: the session check lives behind Suspense so the page
// keeps a prerenderable shell (Cache Components instant-navigation pattern).
async function IndexRedirect() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // redirect() returns `never`, which keeps this a valid JSX component type.
  return redirect('/my/home')
}

export default function IndexPage() {
  return (
    <Suspense fallback={null}>
      <IndexRedirect />
    </Suspense>
  )
}
