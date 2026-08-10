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

  // Google is only accepted when it carries the same address the account was
  // invited under. That keeps one guaranteed email per user, and stops a Google
  // identity from being attachable to an account it has no relationship to.
  // Multiple addresses per user is a later feature.
  const googleIdentity = authData?.user?.identities?.find(
    identity => identity.provider === 'google'
  )
  const googleEmail =
    typeof googleIdentity?.identity_data?.email === 'string'
      ? googleIdentity.identity_data.email
      : null
  const accountEmail = authData?.user?.email ?? null

  const googleLink = googleIdentity
    ? {
        email: googleEmail,
        matchesAccount:
          Boolean(googleEmail) &&
          googleEmail?.toLowerCase() === accountEmail?.toLowerCase(),
      }
    : null

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
      googleLink={googleLink}
      returnedFromGoogle={resolved?.step === 'link-return'}
    />
  )
}
