import { decryptToken, encryptToken } from '@/lib/oauth/encryption'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { refreshAccessToken } from '@/lib/oauth/google'

/**
 * Error thrown when OAuth token refresh fails and user needs to reconnect
 */
export class OAuthReconnectRequiredError extends Error {
  constructor(
    message: string,
    public readonly connectionId: string,
    public readonly provider: string = 'GOOGLE'
  ) {
    super(message)
    this.name = 'OAuthReconnectRequiredError'
  }
}

type GetAccessTokenResult = { accessToken: string; expiresAt?: Date | null; connectionId: string }

interface GmailClientOptions {
  connectionId?: string
}

async function getGoogleConnection(userId: string, connectionId?: string) {
  if (connectionId) {
    // Get specific connection by ID
    const [row] = await db
      .select()
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.id, connectionId),
          eq(oauthConnections.userId, userId),
          eq(oauthConnections.provider, 'GOOGLE')
        )
      )
      .limit(1)
    return row ?? null
  }

  // Fall back to first connected account
  const [row] = await db
    .select()
    .from(oauthConnections)
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, 'GOOGLE')))
    .limit(1)
  return row ?? null
}

async function getValidAccessToken(
  userId: string,
  connectionId?: string
): Promise<GetAccessTokenResult> {
  const conn = await getGoogleConnection(userId, connectionId)
  if (!conn) throw new Error('Google account not connected')

  // Check if connection is already marked as needing reauth
  if (conn.status === 'EXPIRED' || conn.status === 'REVOKED' || conn.status === 'PENDING_REAUTH') {
    throw new OAuthReconnectRequiredError(
      'Gmail connection needs to be reconnected',
      conn.id,
      'GOOGLE'
    )
  }

  const now = Date.now()
  const exp = conn.accessTokenExpiresAt ? new Date(conn.accessTokenExpiresAt).getTime() : undefined
  const needsRefresh = !!exp && exp - now < 5 * 60 * 1000 // under 5 minutes left

  if (!needsRefresh) {
    return { accessToken: decryptToken(conn.accessToken), expiresAt: exp ? new Date(exp) : null, connectionId: conn.id }
  }

  if (!conn.refreshToken) {
    // No refresh token - mark as needing reauth and throw
    await markConnectionNeedsReauth(conn.id, 'No refresh token available')
    throw new OAuthReconnectRequiredError(
      'Gmail connection expired and cannot be refreshed',
      conn.id,
      'GOOGLE'
    )
  }

  try {
    const refreshed = await refreshAccessToken(decryptToken(conn.refreshToken))
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    const newEncryptedAccess = encryptToken(refreshed.access_token)

    await db
      .update(oauthConnections)
      .set({ accessToken: newEncryptedAccess, accessTokenExpiresAt: newExpiresAt, updatedAt: new Date().toISOString() })
      .where(eq(oauthConnections.id, conn.id))

    return { accessToken: refreshed.access_token, expiresAt: new Date(newExpiresAt), connectionId: conn.id }
  } catch (error) {
    // Token refresh failed - mark connection as needing reauth
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await markConnectionNeedsReauth(conn.id, errorMessage)
    throw new OAuthReconnectRequiredError(
      `Gmail token refresh failed: ${errorMessage}`,
      conn.id,
      'GOOGLE'
    )
  }
}

/**
 * Mark a connection as needing re-authentication
 */
async function markConnectionNeedsReauth(connectionId: string, reason: string): Promise<void> {
  const syncState = {
    lastError: reason,
    lastErrorAt: new Date().toISOString(),
    needsReauth: true,
  }

  await db
    .update(oauthConnections)
    .set({
      status: 'PENDING_REAUTH',
      syncState,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(oauthConnections.id, connectionId))
}

// =============================================================================
// SEND EMAIL FUNCTIONS
// =============================================================================

interface SendEmailAttachment {
  filename: string
  mimeType: string
  content: Buffer
}

export interface SendEmailParams {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyHtml?: string
  bodyText?: string
  attachments?: SendEmailAttachment[]
  /** For replies: the Gmail thread ID to keep message in same thread */
  threadId?: string
  /** For replies: Message-ID header of the email being replied to */
  inReplyTo?: string
  /** For replies: References header chain */
  references?: string[]
}

export interface SendEmailResult {
  id: string
  threadId: string
  labelIds: string[]
}

/**
 * Build an RFC 2822 MIME message for sending via Gmail.
 * Handles multipart/mixed for attachments and multipart/alternative for HTML+text.
 */
function buildMimeMessage(
  from: string,
  params: SendEmailParams
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const lines: string[] = []

  // Headers
  lines.push(`From: ${from}`)
  lines.push(`To: ${params.to.join(', ')}`)
  if (params.cc?.length) lines.push(`Cc: ${params.cc.join(', ')}`)
  if (params.bcc?.length) lines.push(`Bcc: ${params.bcc.join(', ')}`)
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`)
  lines.push(`MIME-Version: 1.0`)

  // Threading headers for replies
  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`)
  }
  if (params.references?.length) {
    lines.push(`References: ${params.references.join(' ')}`)
  }

  const hasAttachments = params.attachments && params.attachments.length > 0
  const hasHtml = !!params.bodyHtml
  const hasText = !!params.bodyText

  if (hasAttachments) {
    // multipart/mixed for attachments
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)

    if (hasHtml && hasText) {
      // multipart/alternative for HTML + text
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
      lines.push('')
      lines.push(`--${altBoundary}`)
      lines.push('Content-Type: text/plain; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(params.bodyText || '').toString('base64'))
      lines.push(`--${altBoundary}`)
      lines.push('Content-Type: text/html; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(params.bodyHtml || '').toString('base64'))
      lines.push(`--${altBoundary}--`)
    } else if (hasHtml) {
      lines.push('Content-Type: text/html; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(params.bodyHtml || '').toString('base64'))
    } else {
      lines.push('Content-Type: text/plain; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(Buffer.from(params.bodyText || '').toString('base64'))
    }

    // Add attachments
    for (const att of params.attachments!) {
      lines.push(`--${boundary}`)
      lines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
      lines.push('')
      lines.push(att.content.toString('base64'))
    }
    lines.push(`--${boundary}--`)
  } else if (hasHtml && hasText) {
    // multipart/alternative for HTML + text (no attachments)
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
    lines.push('')
    lines.push(`--${altBoundary}`)
    lines.push('Content-Type: text/plain; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(params.bodyText!).toString('base64'))
    lines.push(`--${altBoundary}`)
    lines.push('Content-Type: text/html; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(params.bodyHtml!).toString('base64'))
    lines.push(`--${altBoundary}--`)
  } else if (hasHtml) {
    lines.push('Content-Type: text/html; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(params.bodyHtml!).toString('base64'))
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(params.bodyText || '').toString('base64'))
  }

  return lines.join('\r\n')
}

/**
 * Send an email via Gmail API.
 * Returns the sent message ID and thread ID.
 */
export async function sendEmail(
  userId: string,
  params: SendEmailParams,
  options?: GmailClientOptions
): Promise<SendEmailResult> {
  const { accessToken, connectionId } = await getValidAccessToken(userId, options?.connectionId)

  // Get sender email from connection
  const conn = await getGoogleConnection(userId, connectionId)
  if (!conn?.providerEmail) {
    throw new Error('Cannot send email: no sender email found for connection')
  }

  const mimeMessage = buildMimeMessage(conn.providerEmail, params)

  // Base64url encode the message
  const encodedMessage = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const body: { raw: string; threadId?: string } = { raw: encodedMessage }
  if (params.threadId) {
    body.threadId = params.threadId
  }

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Gmail send failed: ${errorText}`)
  }

  const result = (await res.json()) as SendEmailResult
  return result
}
