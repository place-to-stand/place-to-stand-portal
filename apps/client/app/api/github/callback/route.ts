import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubAppInstallations } from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { safeRedirectPath } from '@/lib/auth/callback'
import { ensureClientAccess } from '@/lib/auth/permissions'
import { getGitHubAppEnv } from '@/lib/env.server'
import { nanoid } from 'nanoid'

import { getInstallationById } from '@pts/github/app-auth'
import {
  exchangeUserCode,
  revokeUserToken,
  userAuthorizeUrl,
  userCanAccessInstallation,
} from '@pts/github/user-auth'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 600, // 10 minutes
  path: '/',
}

/**
 * GET /api/github/callback
 *
 * GitHub sends people here twice:
 *
 * 1. After installing the App, with `installation_id` and our `state`. The
 *    id alone proves nothing (anyone can type a number), so unless GitHub
 *    also sent a sign-in `code` (the App's "Request user authorization
 *    during installation" setting), the person is sent to sign in to GitHub
 *    as the App, with the installation id held in a cookie.
 * 2. After that sign-in, with `code` and a second state. The code becomes a
 *    short-lived user token, and the installation is saved only if GitHub
 *    lists it among the ones that person's account can reach.
 *
 * Both legs land on this URL, so it must be the App's Callback URL.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const searchParams = request.nextUrl.searchParams
  const installationId = searchParams.get('installation_id')
  const state = searchParams.get('state')
  const cookieStore = await cookies()
  const returnClientId = cookieStore.get('github_app_return_client')?.value
  const returnProjectId = cookieStore.get('github_app_return_project')?.value
  const rawReturnTo = cookieStore.get('github_app_return_to')?.value
  // The install route only stores relative paths, but the cookie is still
  // client-controlled, so re-check before resolving it against request.url.
  const returnTo = rawReturnTo ? safeRedirectPath(rawReturnTo) : null

  // Build redirect paths — returnTo cookie takes precedence, then projectId,
  // then home (there is no standalone GitHub setup page in this app; the
  // install flow always originates from a project page and supplies one).
  let errorPath: string
  let successPath: string

  if (returnTo && returnTo !== '/') {
    errorPath = `${returnTo}?github=error`
    successPath = `${returnTo}?github=installed`
  } else if (returnProjectId) {
    errorPath = `/projects/${returnProjectId}?github=error`
    successPath = `/projects/${returnProjectId}?github=installed`
  } else {
    errorPath = '/?github=error'
    successPath = '/?github=installed'
  }

  const code = searchParams.get('code')
  const env = getGitHubAppEnv()

  // Leg 2: back from the GitHub sign-in we asked for.
  const savedOauthState = cookieStore.get('github_oauth_state')?.value
  const pendingInstallation = cookieStore.get(
    'github_pending_installation'
  )?.value
  const isSignInReturn = Boolean(
    code && state && savedOauthState && savedOauthState === state
  )

  // Leg 1: back from installing; our install state must match.
  const savedInstallState = cookieStore.get('github_app_state')?.value
  const isInstallReturn = Boolean(
    installationId && state && savedInstallState && savedInstallState === state
  )

  if ((!isSignInReturn && !isInstallReturn) || !returnClientId) {
    return NextResponse.redirect(new URL(errorPath, request.url))
  }

  // Re-validate access to the client the install was started for (defense in
  // depth — matches the check the /api/github/install route already made).
  try {
    await ensureClientAccess(user, returnClientId)
  } catch {
    return NextResponse.redirect(new URL(errorPath, request.url))
  }

  const verifiedId = Number.parseInt(
    (isSignInReturn ? pendingInstallation : installationId) ?? '',
    10
  )
  if (!Number.isSafeInteger(verifiedId) || verifiedId <= 0) {
    return NextResponse.redirect(new URL(errorPath, request.url))
  }

  if (!code) {
    // Installed, but no sign-in yet: ask GitHub who this person is. The
    // return cookies stay for leg 2; the install state is spent.
    const oauthState = nanoid(32)
    cookieStore.delete('github_app_state')
    cookieStore.set('github_oauth_state', oauthState, COOKIE_OPTIONS)
    cookieStore.set(
      'github_pending_installation',
      String(verifiedId),
      COOKIE_OPTIONS
    )
    // Give the sign-in its own ten minutes to find where to return.
    for (const name of [
      'github_app_return_client',
      'github_app_return_project',
      'github_app_return_to',
    ]) {
      const value = cookieStore.get(name)?.value
      if (value) cookieStore.set(name, value, COOKIE_OPTIONS)
    }
    return NextResponse.redirect(
      userAuthorizeUrl(env.GITHUB_APP_CLIENT_ID, oauthState)
    )
  }

  // Every state is single-use.
  cookieStore.delete('github_app_state')
  cookieStore.delete('github_oauth_state')
  cookieStore.delete('github_pending_installation')
  cookieStore.delete('github_app_return_client')
  cookieStore.delete('github_app_return_project')
  cookieStore.delete('github_app_return_to')

  try {
    const token = await exchangeUserCode({
      clientId: env.GITHUB_APP_CLIENT_ID,
      clientSecret: env.GITHUB_APP_CLIENT_SECRET,
      code,
    })
    const canAccess = await userCanAccessInstallation(token, verifiedId)
    await revokeUserToken({
      clientId: env.GITHUB_APP_CLIENT_ID,
      clientSecret: env.GITHUB_APP_CLIENT_SECRET,
      token,
    })
    if (!canAccess) {
      return NextResponse.redirect(
        new URL(withReason(errorPath, 'not_your_installation'), request.url)
      )
    }
  } catch (error) {
    console.error('GitHub sign-in check failed:', error)
    return NextResponse.redirect(new URL(errorPath, request.url))
  }

  try {
    // Fetch installation details from GitHub using App JWT
    const installation = await getInstallationById(
      verifiedId,
      env.GITHUB_APP_ID,
      env.GITHUB_APP_PRIVATE_KEY
    )

    // Upsert the installation record
    const existing = await db
      .select({
        id: githubAppInstallations.id,
        companyId: githubAppInstallations.companyId,
      })
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.installationId, installation.id))
      .limit(1)

    if (existing.length > 0) {
      // This installation already belongs to a different client — don't
      // silently reassign ownership; surface it as an error instead.
      if (existing[0].companyId !== returnClientId) {
        return NextResponse.redirect(
          new URL(withReason(errorPath, 'already_linked'), request.url)
        )
      }

      // Update existing installation
      await db
        .update(githubAppInstallations)
        .set({
          accountLogin: installation.account.login,
          accountId: installation.account.id,
          accountType: installation.account.type,
          accountAvatarUrl: installation.account.avatar_url,
          repositorySelection: installation.repository_selection,
          permissions: installation.permissions,
          events: installation.events,
          status: 'ACTIVE',
          suspendedAt: null,
          deletedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(githubAppInstallations.id, existing[0].id))
    } else {
      // Create new installation
      await db.insert(githubAppInstallations).values({
        companyId: returnClientId,
        installedByUserId: user.id,
        installationId: installation.id,
        accountLogin: installation.account.login,
        accountId: installation.account.id,
        accountType: installation.account.type,
        accountAvatarUrl: installation.account.avatar_url,
        repositorySelection: installation.repository_selection,
        permissions: installation.permissions,
        events: installation.events,
      })
    }

    return NextResponse.redirect(new URL(successPath, request.url))
  } catch (error) {
    console.error('GitHub App callback error:', error)
    return NextResponse.redirect(new URL(errorPath, request.url))
  }
}

function withReason(path: string, reason: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}reason=${reason}`
}
