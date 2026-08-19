'use client'

import { useState } from 'react'

import {
  AuthShell,
  authErrorClass,
  authFieldLabelClass,
  authInputClass,
  authPrimaryButtonClass,
} from '@pts/ui/auth-shell'

import { notifyPasswordChanged } from '@/app/(auth)/_actions/auth-emails'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function ForceResetPasswordPage() {
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
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      // Awaited so the request isn't cancelled by the reload below. The action
      // absorbs its own failures, so this can't strand a completed reset.
      await notifyPasswordChanged()

      // Full reload so middleware and server components see the fresh
      // session cookies.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/'
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      label="Client Portal"
      title="Set new password"
      description="Choose a password you'll use to sign in from now on."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className={authErrorClass}>{error}</div>}

        <div className="space-y-2">
          <label htmlFor="password" className={authFieldLabelClass}>
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className={authInputClass}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm" className={authFieldLabelClass}>
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={8}
            className={authInputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={authPrimaryButtonClass}
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}
