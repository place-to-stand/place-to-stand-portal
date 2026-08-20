'use client'

import { useEffect, useState } from 'react'

import {
  AuthShell,
  authErrorClass,
  authFieldLabelClass,
  authInputClass,
  authLinkClass,
  authNoticeClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
} from '@pts/ui/auth-shell'

import { requestMagicLink } from '@/app/(auth)/_actions/auth-emails'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

/**
 * Stops a user who clicks twice from mailing themselves twice.
 *
 * This used to be cosmetic — hosted Supabase enforced its own emails-per-hour
 * limit underneath. Sending through the admin API bypasses that limit, so this
 * cooldown is now the only brake on repeated sends, and it is client-side only.
 * A server-side throttle is still owed.
 */
const MAGIC_LINK_COOLDOWN_SECONDS = 30

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const busy = loading || magicLinkLoading

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      // Hard navigation rather than router.push so the server picks up the new
      // session cookie. Switching to a client transition produces a stale-session
      // bug that looks like sign-in silently failing.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/'
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink() {
    const trimmed = email.trim()

    if (!trimmed) {
      setError('Enter your email above first.')
      return
    }

    setError(null)
    setNotice(null)
    setMagicLinkLoading(true)

    try {
      // Sent by us, not Supabase: the action mints the token with the admin API
      // and mails it with our own template, from the same verified sender the
      // invite uses. Supabase's stock template was the one landing in spam.
      //
      // It never creates an account for an unknown address, and never reports
      // whether one existed — the copy below is identical either way, so this
      // form can't be used to enumerate clients.
      await requestMagicLink(trimmed)

      setNotice(
        "If an account exists for that email, we've sent a sign-in link. Check your inbox."
      )
      setCooldown(MAGIC_LINK_COOLDOWN_SECONDS)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setMagicLinkLoading(false)
    }
  }

  return (
    <AuthShell
      label="Client Portal"
      title="Welcome back"
      description="Sign in to see your projects, hours, and invoices."
      footer={
        <a href="/forgot-password" className={authLinkClass}>
          Forgot your password?
        </a>
      }
    >
      {error && <div className={authErrorClass}>{error}</div>}

      {notice && <div className={authNoticeClass}>{notice}</div>}

      <div className="space-y-3">
        <GoogleSignInButton
          disabled={busy}
          onError={message => setError(message)}
          className={authSecondaryButtonClass}
        />

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={busy || cooldown > 0}
          className={authSecondaryButtonClass}
        >
          {magicLinkLoading
            ? 'Sending...'
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : 'Email me a sign-in link'}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#2a2b30]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#16181c] px-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#a8a8ac]">
            or
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className={authFieldLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={authInputClass}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className={authFieldLabelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={authInputClass}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className={authPrimaryButtonClass}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
