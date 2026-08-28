import { Suspense, type ReactNode } from 'react'

import { requireRole } from '@/lib/auth/session'

// Auth read lives behind Suspense so the settings segment keeps a
// prerenderable shell (Cache Components instant-navigation pattern). The
// layout renders no chrome of its own, so the fallback is null.
async function SettingsGuard({ children }: { children: ReactNode }) {
  await requireRole('ADMIN')

  return <>{children}</>
}

export default function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <SettingsGuard>{children}</SettingsGuard>
    </Suspense>
  )
}
