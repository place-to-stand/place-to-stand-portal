import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  AuthShell,
  authErrorClass,
  authLinkClass,
  authNoticeClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
} from '@pts/ui/auth-shell'

import { getCurrentUser } from '@/lib/auth/session'
import { oauthClientName } from '@/lib/mcp/grants'
import { isAllowedRedirect } from '@/lib/mcp/redirects'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { decideAuthorization } from './actions'

export const metadata: Metadata = {
  title: 'Connect an app',
}

const ACCESS_SUMMARY =
  'It will act as you: read clients, contacts, projects, tasks and leads, and create and update tasks, task comments and leads.'

function redirectHost(uri: string): string | null {
  try {
    return new URL(uri).hostname
  } catch {
    return null
  }
}

/**
 * OAuth consent screen for Supabase Auth's OAuth 2.1 server (PRD 009 §2).
 * Supabase redirects here with an `authorization_id`; the proxy has already
 * sent signed-out visitors through `/sign-in` and back.
 */
export default async function OAuthConsentPage({
  searchParams,
}: PageProps<'/oauth/consent'>) {
  const params = (await searchParams) as {
    authorization_id?: string
    error?: string
  }
  const authorizationId = params.authorization_id

  const user = await getCurrentUser()

  if (!user) {
    const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId ?? '')}`
    redirect(`/sign-in?redirect=${encodeURIComponent(back)}`)
  }

  if (!authorizationId) {
    return (
      <AuthShell
        label='Internal Portal'
        title='Nothing to approve'
        description='This link is missing its authorization request. Start the connection again from the app.'
      >
        {null}
      </AuthShell>
    )
  }

  if (user.role !== 'ADMIN') {
    return (
      <AuthShell
        label='Internal Portal'
        title='Admins only'
        description='Connecting apps to the portal is limited to admin accounts.'
        footer={
          <Link className={authLinkClass} href='/'>
            Back to the portal
          </Link>
        }
      >
        {null}
      </AuthShell>
    )
  }

  const supabase = getSupabaseServerClient()
  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

  if (error || !data) {
    return (
      <AuthShell
        label='Internal Portal'
        title='Unable to load request'
        description='This authorization request has expired or is no longer valid. Start the connection again from the app.'
      >
        {null}
      </AuthShell>
    )
  }

  const target =
    'authorization_id' in data ? data.redirect_uri : data.redirect_url

  if (!isAllowedRedirect(target)) {
    return (
      <AuthShell
        label='Internal Portal'
        title='App not allowed'
        description={`This app would send your access to ${redirectHost(target) ?? 'an unknown address'}. Only Claude (claude.ai, Claude Code) and apps on your own machine can be connected.`}
        footer={
          <Link className={authLinkClass} href='/'>
            Back to the portal
          </Link>
        }
      >
        {null}
      </AuthShell>
    )
  }

  // Already consented: Supabase hands back the redirect straight away.
  if (!('authorization_id' in data)) {
    redirect(data.redirect_url)
  }

  const host = redirectHost(data.redirect_uri)

  return (
    <AuthShell
      wide
      label='Internal Portal'
      title={`Connect ${oauthClientName(data.client)}`}
      description={ACCESS_SUMMARY}
    >
      <div className='space-y-4'>
        {params.error ? (
          <p className={authErrorClass}>
            Unable to record your decision. Try again.
          </p>
        ) : null}

        <p className={authNoticeClass}>
          Signed in as {user.email}. Returns to{' '}
          <span className='font-mono'>{host ?? data.redirect_uri}</span>.
        </p>

        <form action={decideAuthorization} className='space-y-2'>
          <input type='hidden' name='authorizationId' value={authorizationId} />
          <button
            type='submit'
            name='decision'
            value='approve'
            className={authPrimaryButtonClass}
          >
            Connect app
          </button>
          <button
            type='submit'
            name='decision'
            value='deny'
            className={authSecondaryButtonClass}
          >
            Cancel
          </button>
        </form>
      </div>
    </AuthShell>
  )
}
