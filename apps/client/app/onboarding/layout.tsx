export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import { requireClientUser } from '@/lib/auth/session'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireClientUser()

  // Already onboarded — go home
  if (user.onboarding_completed_at) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-lg px-4 py-12">{children}</main>
    </div>
  )
}
