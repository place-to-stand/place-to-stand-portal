import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'

import {
  getValidAccessToken,
  markConnectionNeedsReauth,
  OAuthReconnectRequiredError,
} from './client'
import {
  buildAddressQuery,
  decodeGmailSnippet,
  gmailThreadUrl,
  isGmailAuthFailure,
  mapWithConcurrency,
  parseFromName,
  type GmailAccount,
  type GmailThreadSummary,
} from './threads-utils'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
/** Newest threads per account; enough to scan without a "load more". */
const MAX_THREADS = 15
/** Thread reads at once, well inside Gmail's per-user rate limit. */
const CONCURRENCY = 5

export type ViewerThreadsResult =
  | { state: 'not_connected' }
  | { state: 'reconnect'; accounts: GmailAccount[] }
  | {
      state: 'ok'
      threads: GmailThreadSummary[]
      accounts: GmailAccount[]
      /** Another of the viewer's Google accounts needs reconnecting. */
      someNeedReconnect: boolean
    }

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

/** Gmail said the token is no good: the account must be reconnected. */
class GmailAuthError extends Error {
  constructor(status: number) {
    super(`Gmail refused the token: ${status}`)
    this.name = 'GmailAuthError'
  }
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    if (isGmailAuthFailure(response.status, body)) {
      throw new GmailAuthError(response.status)
    }
    // Rate limits, a thread deleted mid-read, Google hiccups: not the
    // user's connection, so never shown as "reconnect".
    throw new Error(`Gmail request failed: ${response.status} ${body}`)
  }
  return (await response.json()) as T
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
  connection: GmailAccount,
  query: string
): Promise<GmailThreadSummary[]> {
  const { accessToken } = await getValidAccessToken(userId, connection.id)
  const list = await gmailGet<ThreadListResponse>(
    accessToken,
    `/threads?maxResults=${MAX_THREADS}&q=${encodeURIComponent(query)}`
  )

  const metadata =
    '&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date'
  const settled = await mapWithConcurrency(
    list.threads ?? [],
    CONCURRENCY,
    async listed => {
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
        accountEmail: connection.email,
        subject: header(first, 'Subject') || '(no subject)',
        snippet: decodeGmailSnippet(listed.snippet ?? ''),
        lastFrom: parseFromName(header(last, 'From')),
        lastAt,
        messageCount: messages.length,
        url: gmailThreadUrl(thread.id, connection.email),
      } satisfies GmailThreadSummary
    }
  )

  const threads: GmailThreadSummary[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      threads.push(result.value)
    } else if (result.reason instanceof GmailAuthError) {
      throw result.reason
    } else {
      // One unreadable thread (deleted since the list) doesn't hide the rest.
      console.warn('[Gmail] Skipped a thread:', result.reason)
    }
  }
  return threads
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
  const rows = await db
    .select({
      id: oauthConnections.id,
      email: oauthConnections.providerEmail,
    })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, 'GOOGLE'),
        isNull(oauthConnections.deletedAt)
      )
    )

  if (rows.length === 0) return { state: 'not_connected' }
  const accounts: GmailAccount[] = rows

  const query = buildAddressQuery(addresses)
  if (!query) {
    return { state: 'ok', threads: [], accounts, someNeedReconnect: false }
  }

  let reconnects = 0
  const perConnection = await Promise.all(
    accounts.map(async account => {
      try {
        return await threadsForConnection(userId, account, query)
      } catch (error) {
        if (error instanceof GmailAuthError) {
          await markConnectionNeedsReauth(account.id, error.message)
          reconnects += 1
          return []
        }
        if (error instanceof OAuthReconnectRequiredError) {
          reconnects += 1
          return []
        }
        throw error
      }
    })
  )

  if (reconnects === accounts.length) return { state: 'reconnect', accounts }

  const threads = perConnection
    .flat()
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
  return { state: 'ok', threads, accounts, someNeedReconnect: reconnects > 0 }
}
