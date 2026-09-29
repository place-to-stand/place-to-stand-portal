import { getCurrentUser } from '@/lib/auth/session'

import { ForceResetForm } from './force-reset-form'

// Reads the signed-in user, so it can never be prerendered at build time.
export const dynamic = 'force-dynamic'

export default async function ForceResetPasswordPage() {
  const user = await getCurrentUser()

  return <ForceResetForm email={user?.email ?? null} />
}
