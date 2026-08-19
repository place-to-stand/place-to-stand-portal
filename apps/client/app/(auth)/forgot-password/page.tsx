'use client'

import { useState } from 'react'

import {
  AuthShell,
  authErrorClass,
  authFieldLabelClass,
  authInputClass,
  authLinkClass,
  authPrimaryButtonClass,
} from '@pts/ui/auth-shell'

import { requestPasswordReset } from '@/app/(auth)/_actions/auth-emails'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Always reports success, including for addresses with no account — the
      // action logs the real outcome rather than returning it, so this form
      // can't be used to find out who has a portal login.
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        label="Client Portal"
        title="Check your email"
        description={
          <>
            We sent a password reset link to <strong>{email}</strong>.
          </>
        }
        footer={
          <a href="/sign-in" className={authLinkClass}>
            Back to sign in
          </a>
        }
      >
        {null}
      </AuthShell>
    )
  }

  return (
    <AuthShell
      label="Client Portal"
      title="Reset password"
      description="Enter your email and we'll send a reset link."
      footer={
        <a href="/sign-in" className={authLinkClass}>
          Back to sign in
        </a>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className={authErrorClass}>{error}</div>}

        <div className="space-y-2">
          <label htmlFor="email" className={authFieldLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={authInputClass}
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={authPrimaryButtonClass}
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  )
}
