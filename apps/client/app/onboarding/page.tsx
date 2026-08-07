export const dynamic = 'force-dynamic'

import { requireClientUser } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

type PageProps = {
  searchParams?: Promise<{ step?: string }>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const user = await requireClientUser()
  const { data: authData } = await getSupabaseServerClient().auth.getUser()

  // Set at invite time. Under the invite-then-choose flow this means "hasn't
  // picked a sign-in method yet", not "must set a password" — any of the three
  // choices clears it.
  const mustResetPassword =
    authData?.user?.user_metadata?.must_reset_password === true

  const hasGoogleIdentity = Boolean(
    authData?.user?.identities?.some(identity => identity.provider === 'google')
  )

  // `linkIdentity` does a full-page redirect to Google. The wizard's step lives in
  // component state, so without this the user returns to step 0 and the link looks
  // like it did nothing.
  const resolved = searchParams ? await searchParams : undefined

  return (
    <OnboardingWizard
      user={{
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      }}
      mustResetPassword={mustResetPassword}
      hasGoogleIdentity={hasGoogleIdentity}
      returnedFromGoogle={resolved?.step === 'link-return'}
    />
  )
}
