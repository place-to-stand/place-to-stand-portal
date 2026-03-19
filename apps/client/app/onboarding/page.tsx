export const dynamic = 'force-dynamic'

import { requireClientUser } from '@/lib/auth/session'
import { fetchClientProjects } from '@/lib/data/projects'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export default async function OnboardingPage() {
  const user = await requireClientUser()
  const [projects, { data: authData }] = await Promise.all([
    fetchClientProjects(user),
    getSupabaseServerClient().auth.getUser(),
  ])

  const mustResetPassword =
    authData?.user?.user_metadata?.must_reset_password === true

  return (
    <OnboardingWizard
      user={{
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      }}
      projects={projects}
      mustResetPassword={mustResetPassword}
    />
  )
}
