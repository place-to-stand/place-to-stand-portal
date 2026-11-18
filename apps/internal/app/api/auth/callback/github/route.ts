import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { requirePage } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { consumeOAuthReturnTo, validateOAuthState } from '@/lib/oauth/state'
import { oauthLandingPath } from '@/lib/oauth/state-path'
import {
  exchangeCodeForTokens,
  getGitHubUserInfo,
  GITHUB_SCOPES,
} from '@/lib/oauth/github'
import { encryptToken } from '@/lib/oauth/encryption'
import { logActivity } from '@/lib/activity/logger'
import { oauthConnectedEvent } from '@/lib/activity/events'

export async function GET(request: NextRequest) {
  const user = await requirePage('integrations.personal')
  const searchParams = request.nextUrl.searchParams
  // The page the flow started from; without one, the Account sheet.
  const returnTo = await consumeOAuthReturnTo()
  const landing = (result: { success: string } | { error: string }) =>
    NextResponse.redirect(
      new URL(oauthLandingPath(returnTo, result), request.url)
    )

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle user denial
  if (error) {
    return landing({ error: 'access_denied' })
  }

  // Validate required params
  if (!code || !state) {
    return landing({ error: 'invalid_request' })
  }

  // Validate state
  const isValidState = await validateOAuthState(state)
  if (!isValidState) {
    return landing({ error: 'invalid_state' })
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    const userInfo = await getGitHubUserInfo(tokens.access_token)

    // GitHub tokens don't expire by default (unless using expiring tokens)
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.access_token)
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null

    // Use GitHub user ID as providerAccountId (convert number to string)
    const providerAccountId = String(userInfo.id)
    const displayName = userInfo.login // GitHub username

    // Upsert connection by providerAccountId (supports multi-account). A
    // re-auth of a live connection refreshes tokens without logging a second
    // OAUTH_CONNECTED; reconnecting a disconnected account does log.
    let alreadyConnected = false

    await db.transaction(async tx => {
      // Check if this specific GitHub account already exists
      const [existing] = await tx
        .select({
          id: oauthConnections.id,
          deletedAt: oauthConnections.deletedAt,
        })
        .from(oauthConnections)
        .where(
          and(
            eq(oauthConnections.userId, user.id),
            eq(oauthConnections.provider, 'GITHUB'),
            eq(oauthConnections.providerAccountId, providerAccountId)
          )
        )
        .limit(1)

      alreadyConnected = Boolean(existing && !existing.deletedAt)

      if (existing) {
        // Update existing connection (re-auth flow)
        await tx
          .update(oauthConnections)
          .set({
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            accessTokenExpiresAt: expiresAt,
            scopes: GITHUB_SCOPES,
            status: 'ACTIVE',
            providerEmail: userInfo.email,
            displayName: displayName,
            providerMetadata: {
              login: userInfo.login,
              name: userInfo.name,
              avatar_url: userInfo.avatar_url,
            },
            updatedAt: new Date().toISOString(),
            deletedAt: null, // Re-enable if previously soft-deleted
          })
          .where(eq(oauthConnections.id, existing.id))
      } else {
        // Insert new connection (new account)
        await tx.insert(oauthConnections).values({
          userId: user.id,
          provider: 'GITHUB',
          providerAccountId: providerAccountId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          accessTokenExpiresAt: expiresAt,
          scopes: GITHUB_SCOPES,
          status: 'ACTIVE',
          providerEmail: userInfo.email,
          displayName: displayName,
          providerMetadata: {
            login: userInfo.login,
            name: userInfo.name,
            avatar_url: userInfo.avatar_url,
          },
        })
      }
    })

    if (!alreadyConnected) {
      const event = oauthConnectedEvent({
        provider: 'GITHUB',
        accountLabel: userInfo.login,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'SETTINGS',
        targetId: user.id,
        metadata: event.metadata,
      })
    }

    return landing({ success: 'github_connected' })
  } catch (err) {
    console.error('GitHub OAuth error:', err)
    return landing({ error: 'oauth_failed' })
  }
}
