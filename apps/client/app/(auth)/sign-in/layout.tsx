// Reads the session per request; without this the build tries to prerender
// /sign-in and calls Supabase at build time.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/session'

/**
 * The marketing site's "Client Login" link points straight here (linking the
 * root would send crawlers through a redirect). Someone who is already signed
 * in should land on their portal, not a sign-in form.
 *
 * No loop: getCurrentUser() returns null for anyone the portal would bounce
 * back to /sign-in, and the wrong role goes to /unauthorized instead.
 */
export default async function SignInLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (await getCurrentUser()) {
    redirect('/')
  }

  return children
}
