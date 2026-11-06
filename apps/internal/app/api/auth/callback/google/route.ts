import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'

import { roleCan } from '@/lib/auth/capabilities'
import { requirePage } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { consumeOAuthReturnTo, validateOAuthState } from '@/lib/oauth/state'
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  GOOGLE_SCOPES,
} from '@/lib/oauth/google'
import { encryptToken } from '@/lib/oauth/encryption'
import { logActivity } from '@/lib/activity/logger'
import { oauthConnectedEvent } from '@/lib/activity/events'

export async function GET(request: NextRequest) {
  const user = await requirePage('integrations.google')
  const searchParams = request.nextUrl.searchParams
  // Set when the flow started outside Settings (the lead sheet): land back
  // there, where the Emails section shows the result for itself.
  const returnTo = await consumeOAuthReturnTo()
  // Without a start page (its cookie expired), only admins have Settings.
  const fallback = (settingsPath: string) =>
    roleCan(user.role, 'integrations.manage') ? settingsPath : '/leads'
  const landing = (settingsPath: string) =>
    NextResponse.redirect(
      new URL(returnTo ?? fallback(settingsPath), request.url)
    )

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle user denial
  if (error) {
    return landing('/settings/integrations?error=access_denied')
  }

  // Validate required params
  if (!code || !state) {
    return landing('/settings/integrations?error=invalid_request')
  }

  // Validate state
  const isValidState = await validateOAuthState(state)
  if (!isValidState) {
    return landing('/settings/integrations?error=invalid_state')
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    const userInfo = await getGoogleUserInfo(tokens.access_token)

    // Calculate expiry
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString()

    // What Google actually granted (a user can untick scopes).
    const grantedScopes = tokens.scope
      ? tokens.scope.split(' ').filter(Boolean)
      : GOOGLE_SCOPES

    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.access_token)
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null

    // Upsert connection by providerAccountId (supports multi-account). A
    // re-auth of a live connection refreshes tokens without logging a second
    // OAUTH_CONNECTED; reconnecting a disconnected account does log.
    let alreadyConnected = false

    await db.transaction(async tx => {
      // Check if this specific Google account already exists
      const [existing] = await tx
        .select({
          id: oauthConnections.id,
          deletedAt: oauthConnections.deletedAt,
        })
        .from(oauthConnections)
        .where(
          and(
            eq(oauthConnections.userId, user.id),
            eq(oauthConnections.provider, 'GOOGLE'),
            eq(oauthConnections.providerAccountId, userInfo.id)
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
            scopes: grantedScopes,
            status: 'ACTIVE',
            providerEmail: userInfo.email,
            displayName: userInfo.email,
            providerMetadata: {
              name: userInfo.name,
              picture: userInfo.picture,
            },
            updatedAt: new Date().toISOString(),
            deletedAt: null, // Re-enable if previously soft-deleted
          })
          .where(eq(oauthConnections.id, existing.id))
      } else {
        // Insert new connection (new account)
        await tx.insert(oauthConnections).values({
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId: userInfo.id,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          accessTokenExpiresAt: expiresAt,
          scopes: grantedScopes,
          status: 'ACTIVE',
          providerEmail: userInfo.email,
          displayName: userInfo.email,
          providerMetadata: {
            name: userInfo.name,
            picture: userInfo.picture,
          },
        })
      }
    })

    if (!alreadyConnected) {
      const event = oauthConnectedEvent({
        provider: 'GOOGLE',
        accountLabel: userInfo.email,
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

    return landing('/settings/integrations?success=google_connected')
  } catch (err) {
    console.error('Google OAuth error:', err)
    return landing('/settings/integrations?error=oauth_failed')
  }
}
