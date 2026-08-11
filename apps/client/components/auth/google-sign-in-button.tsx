'use client'

import { useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type Props = {
  /** Relative path to land on after the callback exchanges the code. */
  redirectTo?: string
  disabled?: boolean
  onError?: (message: string) => void
  label?: string
  /**
   * Attach Google to the session's existing auth user instead of signing in.
   *
   * Used during onboarding, where the invite link has already authenticated them.
   * This is what makes a mismatched address work — an admin invites
   * `someone@company.com` but they want to use `someone@gmail.com`, which would
   * never auto-link on an email match.
   */
  linkExisting?: boolean
  /**
   * Address to pre-select in Google's account chooser.
   *
   * A hint, not a constraint — Google lets the user switch accounts, and nothing
   * stops them picking another. It exists so the invited address is the default
   * rather than whichever personal account the browser happens to be signed into,
   * which is where mismatches otherwise come from.
   */
  loginHint?: string
}

/**
 * OAuth needs a full browser redirect, so this stays client-side.
 *
 * Copy reads as *sign in*, never *sign up*: portal accounts are created by an
 * admin, and an unprovisioned Google account is bounced at the callback.
 */
export function GoogleSignInButton({
  redirectTo,
  disabled,
  onError,
  label = 'Continue with Google',
  linkExisting = false,
  loginHint,
}: Props) {
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const callbackPath = redirectTo
        ? `/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`
        : '/auth/callback'
      const options = {
        redirectTo: `${window.location.origin}${callbackPath}`,
        // Google reads `login_hint` from the authorization URL; Supabase forwards
        // `queryParams` there verbatim. Omitted entirely when absent rather than
        // sent empty, which Google treats as a malformed hint.
        ...(loginHint ? { queryParams: { login_hint: loginHint } } : {}),
      }

      const { error } = linkExisting
        ? await supabase.auth.linkIdentity({ provider: 'google', options })
        : await supabase.auth.signInWithOAuth({ provider: 'google', options })

      if (error) {
        console.error('Failed to start Google OAuth flow', error)
        onError?.("We couldn't reach Google. Please try again.")
        setIsPending(false)
      }
      // On success the browser navigates away — leave the spinner running.
    } catch {
      onError?.("We couldn't reach Google. Please try again.")
      setIsPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isPending}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50"
    >
      <GoogleMark />
      {isPending ? 'Redirecting...' : label}
    </button>
  )
}

function GoogleMark() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}
