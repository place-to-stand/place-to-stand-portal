'use client'

import { useEffect, useState } from 'react'

import { Button } from '@pts/ui/button'
import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { notifyPasswordChanged } from '@/app/(auth)/_actions/auth-emails'
import { completeOnboarding } from '@/app/onboarding/_actions/complete-onboarding'

type OnboardingUser = {
  id: string
  email: string
  fullName: string | null
}

/** The Google identity on this account, if one is attached. */
type GoogleLink = {
  email: string | null
  /** Google auth is only honoured when its address matches the account's. */
  matchesAccount: boolean
}

type OnboardingWizardProps = {
  user: OnboardingUser
  /** Invite-time flag. Means "hasn't chosen a sign-in method yet". */
  mustResetPassword: boolean
  googleLink: GoogleLink | null
  /** True when the browser just came back from the Google linking redirect. */
  returnedFromGoogle: boolean
}

const STEP_WELCOME = 0
const STEP_CHOOSE = 1
const STEP_DONE = 2

export function OnboardingWizard({
  user,
  mustResetPassword,
  googleLink,
  returnedFromGoogle,
}: OnboardingWizardProps) {
  // Returning from Google lands mid-flow, so the opening step is derived rather
  // than always 0.
  const [step, setStep] = useState(() =>
    returnedFromGoogle ? STEP_CHOOSE : STEP_WELCOME
  )
  const [error, setError] = useState<string | null>(null)

  const firstName = user.fullName?.split(' ')[0] ?? user.email.split('@')[0]

  function advanceFromWelcome() {
    setStep(mustResetPassword ? STEP_CHOOSE : STEP_DONE)
  }

  if (step === STEP_WELCOME) {
    return (
      <div className='space-y-6 text-center'>
        <div className='space-y-2'>
          <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
            Welcome, {firstName}
          </h1>
          <p className='text-muted-foreground text-sm'>
            Let&apos;s get your portal set up. It only takes a minute.
          </p>
        </div>
        <Button onClick={advanceFromWelcome} className='w-full sm:w-auto'>
          Get started
        </Button>
      </div>
    )
  }

  if (step === STEP_CHOOSE) {
    return (
      <ChooseSignInStep
        accountEmail={user.email}
        googleLink={googleLink}
        returnedFromGoogle={returnedFromGoogle}
        error={error}
        onError={setError}
        onComplete={() => setStep(STEP_DONE)}
      />
    )
  }

  return (
    <div className='space-y-6 text-center'>
      <div className='space-y-2'>
        <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
          You&apos;re all set
        </h1>
        <p className='text-muted-foreground text-sm'>
          Your portal is ready. You can see your projects and the hours
          remaining on your account from the dashboard.
        </p>
      </div>
      <form action={completeOnboarding}>
        <Button type='submit' className='w-full sm:w-auto'>
          Go to dashboard
        </Button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Choose sign-in method                                             */
/* ------------------------------------------------------------------ */

type ChooseProps = {
  accountEmail: string
  googleLink: GoogleLink | null
  returnedFromGoogle: boolean
  error: string | null
  onError: (message: string | null) => void
  onComplete: () => void
}

/**
 * All three options attach to the *same* auth user — the one created at invite
 * time, which the invite link already signed them into. They are not exclusive:
 * whichever they pick here, the others stay available from the sign-in page.
 */
function ChooseSignInStep({
  accountEmail,
  googleLink,
  returnedFromGoogle,
  error,
  onError,
  onComplete,
}: ChooseProps) {
  const [mode, setMode] = useState<'menu' | 'password'>('menu')

  // Both failure shapes are knowable at render time, so neither needs an effect.
  // Google chooses which account signs in, so a mismatch can only be caught on
  // the way back — and must then be undone, not merely reported.
  const linkFailed = returnedFromGoogle && !googleLink
  const linkMismatched =
    returnedFromGoogle && Boolean(googleLink) && !googleLink?.matchesAccount

  const [settling, setSettling] = useState(
    returnedFromGoogle && Boolean(googleLink?.matchesAccount)
  )

  const shownError =
    error ??
    (linkMismatched
      ? `That Google account (${googleLink?.email ?? 'unknown'}) doesn't match ${accountEmail}. Sign in with Google using ${accountEmail}, or choose another option.`
      : linkFailed
        ? "Google linking didn't complete. Pick an option to continue."
        : null)

  useEffect(() => {
    if (!returnedFromGoogle || !googleLink) return

    // A mismatched identity is detached rather than left dangling. Leaving it
    // would let a client sign in under an address the account was never issued,
    // which is the guarantee this check exists to hold.
    if (!googleLink.matchesAccount) {
      void unlinkGoogleIdentity().catch(unlinkError => {
        console.error(
          'Failed to detach mismatched Google identity',
          unlinkError
        )
      })
      return
    }

    void clearMustResetPassword()
      .then(onComplete)
      .catch(() => {
        onError('Your Google account is linked, but we hit a snag saving it.')
        setSettling(false)
      })
    // Runs once, on the return leg of the redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (settling) {
    return (
      <p className='text-muted-foreground text-center text-sm'>
        Finishing up...
      </p>
    )
  }

  if (mode === 'password') {
    return (
      <SetPasswordStep onBack={() => setMode('menu')} onComplete={onComplete} />
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
          How would you like to sign in?
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Pick whichever is easiest. You can use the others later too — they all
          get you into the same account.
        </p>
      </div>

      {shownError && (
        <div className='bg-destructive/10 text-destructive rounded-md p-3 text-sm'>
          {shownError}
        </div>
      )}

      <div className='space-y-3'>
        <div className='space-y-1'>
          <GoogleSignInButton
            label='Connect your Google account'
            redirectTo='/onboarding?step=link-return'
            onError={onError}
            linkExisting
            loginHint={accountEmail}
          />
          <p className='text-muted-foreground text-xs'>
            Use the Google account for {accountEmail}.
          </p>
        </div>

        <Button
          variant='outline'
          className='w-full'
          onClick={() => {
            onError(null)
            setMode('password')
          }}
        >
          Set a password
        </Button>

        <MagicLinkOnlyButton onError={onError} onComplete={onComplete} />
      </div>

      <p className='text-muted-foreground text-xs'>
        However you sign in, you can always use &ldquo;forgot password&rdquo; to
        get back in from your email.
      </p>
    </div>
  )
}

function MagicLinkOnlyButton({
  onError,
  onComplete,
}: {
  onError: (message: string | null) => void
  onComplete: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    onError(null)

    try {
      await clearMustResetPassword()
      onComplete()
    } catch {
      onError('Unable to save your choice. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Button
      variant='outline'
      className='w-full'
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? 'Saving...' : 'Just email me a link each time'}
    </Button>
  )
}

/**
 * Marks the sign-in method as chosen. Every option calls this — leaving the flag
 * set would strand passwordless clients on this step forever.
 */
async function clearMustResetPassword(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.auth.updateUser({
    data: { must_reset_password: false },
  })

  if (error) {
    throw error
  }
}

/**
 * Detaches a Google identity whose address doesn't match the account.
 *
 * Requires `enable_manual_linking` — the same setting `linkIdentity` needs, so
 * if linking was possible, unlinking is too.
 */
async function unlinkGoogleIdentity(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.auth.getUserIdentities()

  if (error) throw error

  const google = data?.identities?.find(
    identity => identity.provider === 'google'
  )

  if (!google) return

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(google)

  if (unlinkError) throw unlinkError
}

/* ------------------------------------------------------------------ */
/*  Set Password Step                                                 */
/* ------------------------------------------------------------------ */

function SetPasswordStep({
  onComplete,
  onBack,
}: {
  onComplete: () => void
  onBack: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { must_reset_password: false },
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      // The password is set from the browser, so the notice has to be asked for.
      // The action absorbs its own failures — onboarding must not stall on mail.
      await notifyPasswordChanged()

      onComplete()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
          Set your password
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Choose a secure password you&apos;ll use to sign in going forward.
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        {error && (
          <div className='bg-destructive/10 text-destructive rounded-md p-3 text-sm'>
            {error}
          </div>
        )}

        <div className='space-y-2'>
          <Label htmlFor='new-password'>New password</Label>
          <Input
            id='new-password'
            type='password'
            autoComplete='new-password'
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='confirm-password'>Confirm password</Label>
          <Input
            id='confirm-password'
            type='password'
            autoComplete='new-password'
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <Button type='submit' disabled={loading} className='w-full'>
          {loading ? 'Updating...' : 'Set password & continue'}
        </Button>
      </form>

      <Button
        type='button'
        variant='link'
        onClick={onBack}
        className='text-muted-foreground hover:text-foreground w-full'
      >
        Choose a different way to sign in
      </Button>
    </div>
  )
}
