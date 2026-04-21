import 'server-only'

import { createSign } from 'node:crypto'

import { serverEnv } from '@/lib/env.server'
import { getValidAccessToken } from '@/lib/gmail/client'

const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

type ServiceAccountKey = {
  client_email: string
  private_key: string
  token_uri?: string
}

type CachedToken = {
  accessToken: string
  expiresAt: number
  subject: string
  scope: string
}

const TOKEN_URI_DEFAULT = 'https://oauth2.googleapis.com/token'
const REFRESH_MARGIN_MS = 60_000

const tokenCache = new Map<string, CachedToken>()
let cachedKey: ServiceAccountKey | null = null

function parseServiceAccountKey(raw: string): ServiceAccountKey {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as ServiceAccountKey).client_email !== 'string' ||
    typeof (parsed as ServiceAccountKey).private_key !== 'string'
  ) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key')
  }

  const key = parsed as ServiceAccountKey
  return {
    client_email: key.client_email,
    // Vercel/env stores often double-escape newlines in the PEM body
    private_key: key.private_key.replace(/\\n/g, '\n'),
    token_uri: key.token_uri,
  }
}

function getKey(): ServiceAccountKey | null {
  if (!serverEnv.GOOGLE_SERVICE_ACCOUNT_KEY) return null
  if (!cachedKey) {
    cachedKey = parseServiceAccountKey(serverEnv.GOOGLE_SERVICE_ACCOUNT_KEY)
  }
  return cachedKey
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function mintAccessToken(
  key: ServiceAccountKey,
  scope: string,
  subject: string
): Promise<CachedToken> {
  const now = Math.floor(Date.now() / 1000)
  const tokenUri = key.token_uri ?? TOKEN_URI_DEFAULT

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: key.client_email,
      scope,
      aud: tokenUri,
      exp: now + 3600,
      iat: now,
      sub: subject,
    })
  )
  const signingInput = `${header}.${claims}`

  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()
  const signature = base64UrlEncode(signer.sign(key.private_key))
  const assertion = `${signingInput}.${signature}`

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Service account token exchange failed: ${errorText}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    subject,
    scope,
  }
}

/**
 * Returns true when a service account + impersonation subject are configured.
 */
export function isServiceAccountConfigured(): boolean {
  return Boolean(
    serverEnv.GOOGLE_SERVICE_ACCOUNT_KEY &&
      serverEnv.GOOGLE_WORKSPACE_IMPERSONATION_SUBJECT
  )
}

/**
 * Mint an access token for the configured service account, impersonating the
 * configured workspace subject via domain-wide delegation.
 *
 * Returns null if the feature is not configured — callers should fall back to
 * the requesting user's OAuth token.
 */
export async function getServiceAccountAccessToken(
  scopes: string[]
): Promise<string | null> {
  const key = getKey()
  const subject = serverEnv.GOOGLE_WORKSPACE_IMPERSONATION_SUBJECT
  if (!key || !subject) return null

  const scope = [...scopes].sort().join(' ')
  const cacheKey = `${subject}|${scope}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return cached.accessToken
  }

  const fresh = await mintAccessToken(key, scope, subject)
  tokenCache.set(cacheKey, fresh)
  return fresh.accessToken
}

/**
 * Get an access token for reading Drive files (transcripts).
 *
 * Prefers the service account impersonating the configured workspace subject,
 * which gives uniform access across all users. Falls back to the requesting
 * user's OAuth token when the service account isn't configured or fails to mint.
 */
export async function getDriveReadAccessToken(userId: string): Promise<string> {
  if (isServiceAccountConfigured()) {
    try {
      const token = await getServiceAccountAccessToken([DRIVE_READ_SCOPE])
      if (token) return token
    } catch (error) {
      console.error(
        '[Service Account] Drive token mint failed; falling back to user OAuth:',
        error
      )
    }
  }

  const { accessToken } = await getValidAccessToken(userId)
  return accessToken
}

