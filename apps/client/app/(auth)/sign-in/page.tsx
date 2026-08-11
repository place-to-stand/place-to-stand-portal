'use client'

import { useEffect, useState } from 'react'

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

const INPUT_CLASS =
  'w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/20'

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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Client Portal
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            Sign in to your account
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-md border border-foreground/15 p-3 text-sm text-foreground/70">
            {notice}
          </div>
        )}

        <div className="space-y-3">
          <GoogleSignInButton
            disabled={busy}
            onError={message => setError(message)}
          />

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={busy || cooldown > 0}
            className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50"
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
            <span className="w-full border-t border-foreground/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-foreground/50">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={INPUT_CLASS}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-foreground/60">
          <a
            href="/forgot-password"
            className="underline hover:text-foreground"
          >
            Forgot your password?
          </a>
        </p>
      </div>
    </div>
  )
}
