import type { ReactNode } from 'react'

import { requireRole } from '@/lib/auth/session'

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireRole('ADMIN')

  return <>{children}</>
}
