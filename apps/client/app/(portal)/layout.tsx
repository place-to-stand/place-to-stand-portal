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
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-foreground">
              Place to Stand
            </span>
            <nav className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-sm text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              >
                Projects
              </Link>
              <Link
                href="/github/setup"
                className="rounded-md px-3 py-1.5 text-sm text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              >
                GitHub
              </Link>
            </nav>
          </div>
          <UserMenu
            email={user.email}
            fullName={user.full_name}
            avatarUrl={user.avatar_url}
          />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
