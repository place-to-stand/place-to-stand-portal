'use client'

import { useState } from 'react'

import {
  AuthShell,
  authErrorClass,
  authFieldLabelClass,
  authInputClass,
  authPrimaryButtonClass,
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_SHORT,
  PASSWORDS_DIFFER,
} from '@pts/ui/auth-shell'

import { notifyPasswordChanged } from '@/app/(auth)/_actions/auth-emails'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type ForceResetFormProps = {
  /** The signed-in account, shown so the browser saves the password under it. */
  email: string | null
}

export function ForceResetForm({ email }: ForceResetFormProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError(PASSWORDS_DIFFER)
      return
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_TOO_SHORT)
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
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full reload so the server sees the fresh session cookies
      window.location.href = '/'
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      label='Client Portal'
      title='Set new password'
      description="Choose a password you'll use to sign in from now on."
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        {error && <div className={authErrorClass}>{error}</div>}

        {email ? (
          // Read-only, but a real `username` field: without one, password
          // managers save the new password under a blank username.
          <div className='space-y-2'>
            <label htmlFor='email' className={authFieldLabelClass}>
              Email
            </label>
            <input
              id='email'
              name='username'
              type='email'
              autoComplete='username'
              value={email}
              readOnly
              className={authInputClass}
            />
          </div>
        ) : null}

        <div className='space-y-2'>
          <label htmlFor='password' className={authFieldLabelClass}>
            New password
          </label>
          <input
            id='password'
            name='new-password'
            type='password'
            autoComplete='new-password'
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
            className={authInputClass}
          />
        </div>

        <div className='space-y-2'>
          <label htmlFor='confirm' className={authFieldLabelClass}>
            Confirm password
          </label>
          <input
            id='confirm'
            name='confirm-password'
            type='password'
            autoComplete='new-password'
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
            className={authInputClass}
          />
        </div>

        <button
          type='submit'
          disabled={loading}
          className={authPrimaryButtonClass}
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}
