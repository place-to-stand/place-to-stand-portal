import type { ReactNode } from 'react'

import { requireRole } from '@/lib/auth/session'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireRole('ADMIN')

  return <>{children}</>
}
