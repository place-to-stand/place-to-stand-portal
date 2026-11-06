import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'

import { getValidAccessToken, OAuthReconnectRequiredError } from './client'
import {
  buildAddressQuery,
  decodeGmailSnippet,
  gmailThreadUrl,
  parseFromName,
  type GmailThreadSummary,
} from './threads-utils'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MAX_THREADS = 25

export type ViewerThreadsResult =
  | { state: 'not_connected' }
  | { state: 'reconnect' }
  | { state: 'ok'; threads: GmailThreadSummary[] }

type ThreadListResponse = {
  threads?: { id: string; snippet?: string }[]
}

type ThreadResponse = {
  id: string
  messages?: {
    internalDate?: string
    payload?: { headers?: { name: string; value: string }[] }
  }[]
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (response.status === 401 || response.status === 403) {
    throw new GmailAccessError(response.status)
  }
  if (!response.ok) {
    throw new Error(`Gmail request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

class GmailAccessError extends Error {
  constructor(status: number) {
    super(`Gmail refused the request: ${status}`)
    this.name = 'GmailAccessError'
  }
}

function header(
  message: NonNullable<ThreadResponse['messages']>[number] | undefined,
  name: string
) {
  return (
    message?.payload?.headers?.find(
      h => h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? null
  )
}

async function threadsForConnection(
  userId: string,
  connection: { id: string; providerEmail: string | null },
  query: string
): Promise<GmailThreadSummary[]> {
  const { accessToken } = await getValidAccessToken(userId, connection.id)
  const list = await gmailGet<ThreadListResponse>(
    accessToken,
    `/threads?maxResults=${MAX_THREADS}&q=${encodeURIComponent(query)}`
  )

  const metadata =
    '&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date'
  return Promise.all(
    (list.threads ?? []).map(async listed => {
      const thread = await gmailGet<ThreadResponse>(
        accessToken,
        `/threads/${encodeURIComponent(listed.id)}?format=metadata${metadata}`
      )
      const messages = thread.messages ?? []
      const first = messages[0]
      const last = messages[messages.length - 1]
      const lastAt = last?.internalDate
        ? new Date(Number(last.internalDate)).toISOString()
        : null
      return {
        id: thread.id,
        accountEmail: connection.providerEmail,
        subject: header(first, 'Subject') || '(no subject)',
        snippet: decodeGmailSnippet(listed.snippet ?? ''),
        lastFrom: parseFromName(header(last, 'From')),
        lastAt,
        messageCount: messages.length,
        url: gmailThreadUrl(thread.id, connection.providerEmail),
      }
    })
  )
}

/**
 * Gmail threads with any of `addresses`, read live from the viewer's own
 * connected Google accounts, newest first. Never another person's mailbox:
 * Jason chose (Nov 2026) that each viewer sees only their own mail. Nothing
 * is stored.
 */
export async function listViewerThreadsWith(
  userId: string,
  addresses: string[]
): Promise<ViewerThreadsResult> {
  const connections = await db
    .select({
      id: oauthConnections.id,
      providerEmail: oauthConnections.providerEmail,
      status: oauthConnections.status,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, 'GOOGLE'),
        isNull(oauthConnections.deletedAt)
      )
    )

  if (connections.length === 0) return { state: 'not_connected' }

  const query = buildAddressQuery(addresses)
  if (!query) return { state: 'ok', threads: [] }

  let needsReconnect = false
  const perConnection = await Promise.all(
    connections.map(async connection => {
      try {
        return await threadsForConnection(userId, connection, query)
      } catch (error) {
        if (
          error instanceof OAuthReconnectRequiredError ||
          error instanceof GmailAccessError
        ) {
          needsReconnect = true
          return []
        }
        throw error
      }
    })
  )

  const threads = perConnection
    .flat()
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))

  if (threads.length === 0 && needsReconnect) return { state: 'reconnect' }
  return { state: 'ok', threads }
}
