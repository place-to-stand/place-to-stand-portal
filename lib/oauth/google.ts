import { serverEnv } from '@/lib/env.server'

// Google scopes - Gmail, Calendar, Drive/Docs, and Sheets
export const GOOGLE_SCOPES = [
  // User info
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  // Gmail - read, modify, compose, send, and settings
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.settings.basic', // For reading/updating signatures
  // Calendar - create events with Meet links
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  // Drive/Docs - copy templates and create proposals
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  // Sheets - for reporting and data export
  'https://www.googleapis.com/auth/spreadsheets',
]

// Scopes required for sending emails (used to check if re-auth needed)
export const GMAIL_SEND_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
]

// Scopes required for Calendar/Meet functionality
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
]

// Scopes required for Drive/Docs proposal functionality
export const GOOGLE_DOCS_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
]

// Scopes required for Sheets functionality
export const GOOGLE_SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
]

/**
 * Check if a connection has the required scopes for sending emails.
 * Returns true if all send scopes are present.
 */
export function hasComposeScopes(grantedScopes: string[]): boolean {
  return GMAIL_SEND_SCOPES.every((scope) => grantedScopes.includes(scope))
}

/**
 * Check if a connection has the required scopes for Calendar/Meet.
 * Returns true if all calendar scopes are present.
 */
export function hasCalendarScopes(grantedScopes: string[]): boolean {
  return GOOGLE_CALENDAR_SCOPES.every((scope) => grantedScopes.includes(scope))
}

/**
 * Check if a connection has the required scopes for Drive/Docs.
 * Returns true if all docs scopes are present.
 */
export function hasDocsScopes(grantedScopes: string[]): boolean {
  return GOOGLE_DOCS_SCOPES.every((scope) => grantedScopes.includes(scope))
}

/**
 * Check if a connection has the required scopes for Sheets.
 * Returns true if all sheets scopes are present.
 */
export function hasSheetsScopes(grantedScopes: string[]): boolean {
  return GOOGLE_SHEETS_SCOPES.every((scope) => grantedScopes.includes(scope))
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export interface GoogleUserInfo {
  id: string
  email: string
  name?: string
  picture?: string
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: serverEnv.GOOGLE_CLIENT_ID,
    redirect_uri: serverEnv.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline', // Required for refresh token
    prompt: 'consent', // Force consent to get refresh token
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: serverEnv.GOOGLE_CLIENT_ID,
      client_secret: serverEnv.GOOGLE_CLIENT_SECRET,
      redirect_uri: serverEnv.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
      code,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

/**
 * Refresh an access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: serverEnv.GOOGLE_CLIENT_ID,
      client_secret: serverEnv.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  return response.json()
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    throw new Error('Failed to get user info')
  }

  return response.json()
}

/**
 * Revoke a token (for disconnect)
 * Logs failures for monitoring but doesn't throw - caller handles soft delete regardless
 */
export async function revokeToken(token: string): Promise<void> {
  const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
    method: 'POST',
  })

  if (!response.ok) {
    // Log for monitoring - token may already be invalid/expired
    // Don't throw: caller will soft-delete connection regardless
    console.warn('[Google OAuth] Token revocation failed:', {
      status: response.status,
      statusText: response.statusText,
    })
  }
}
