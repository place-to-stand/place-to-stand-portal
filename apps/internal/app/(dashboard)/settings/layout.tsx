import type { ReactNode } from 'react'

import { requirePage } from '@/lib/auth/session'

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  await requirePage('portal.admin')

  return <>{children}</>
}
