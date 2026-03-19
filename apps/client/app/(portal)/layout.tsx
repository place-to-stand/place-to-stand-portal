export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireClientUser } from '@/lib/auth/session'
import { UserMenu } from '@/components/layout/user-menu'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireClientUser()

  // Redirect CLIENT users to onboarding if they haven't completed it.
  // Admins skip onboarding (they're just previewing the portal).
  if (user.role === 'CLIENT' && !user.onboarding_completed_at) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/" className="text-sm font-semibold text-foreground">
            Place to Stand
          </Link>
          <UserMenu
            email={user.email}
            fullName={user.full_name}
            avatarUrl={user.avatar_url}
          />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
    </div>
  )
}
