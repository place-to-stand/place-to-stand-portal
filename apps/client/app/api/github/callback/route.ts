import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { githubAppInstallations, clientMembers } from '@pts/db/schema'
import { getCurrentUser } from '@/lib/auth/session'
import { getEnv } from '@/lib/env.server'
import { getInstallationById } from '@pts/github/app-auth'

/**
 * GET /api/github/callback
 *
 * Handles the redirect from GitHub after the user installs the GitHub App.
 * Validates the state cookie, fetches installation details, and saves to DB.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const searchParams = request.nextUrl.searchParams
  const installationId = searchParams.get('installation_id')
  const state = searchParams.get('state')
  const setupAction = searchParams.get('setup_action') // 'install' | 'update'

  if (!installationId || !state) {
    return NextResponse.redirect(
      new URL('/github/setup?error=missing_params', request.url)
    )
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const savedState = cookieStore.get('github_app_state')?.value

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL('/github/setup?error=invalid_state', request.url)
    )
  }

  // Clear the state cookie
  cookieStore.delete('github_app_state')

  const env = getEnv()

  try {
    // Fetch installation details from GitHub using App JWT
    const installation = await getInstallationById(
      parseInt(installationId, 10),
      env.GITHUB_APP_ID,
      env.GITHUB_APP_PRIVATE_KEY
    )

    // Find which client this user belongs to
    const [membership] = await db
      .select({ clientId: clientMembers.clientId })
      .from(clientMembers)
      .where(
        and(
          eq(clientMembers.userId, user.id),
          isNull(clientMembers.deletedAt)
        )
      )
      .limit(1)

    if (!membership) {
      return NextResponse.redirect(
        new URL('/github/setup?error=no_client', request.url)
      )
    }

    // Upsert the installation record
    const existing = await db
      .select({ id: githubAppInstallations.id })
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.installationId, installation.id))
      .limit(1)

    if (existing.length > 0) {
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
        clientId: membership.clientId,
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

    return NextResponse.redirect(
      new URL('/github/setup?success=true', request.url)
    )
  } catch (error) {
    console.error('GitHub App callback error:', error)
    return NextResponse.redirect(
      new URL('/github/setup?error=callback_failed', request.url)
    )
  }
}
