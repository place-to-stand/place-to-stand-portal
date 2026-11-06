'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Mail } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { formatRelativeTime } from '@pts/ui/dates'
import { EmptyState } from '@pts/ui/empty-state'
import { Skeleton } from '@pts/ui/skeleton'
import { EntityList } from '@/components/sheets/entity-list'
import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import { LoadMoreButton } from '@/components/ui/load-more-button'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { roleCan } from '@/lib/auth/capabilities'
import type {
  GmailAccount,
  GmailThreadSummary,
  ThreadsCursor,
} from '@/lib/gmail/threads-utils'
import type { LeadRecord } from '@/lib/leads/types'

type EmailsResponse =
  | { state: 'not_allowed' | 'no_email' | 'not_connected' }
  | { state: 'reconnect'; accounts: GmailAccount[] }
  | {
      state: 'ok'
      threads: GmailThreadSummary[]
      accounts: GmailAccount[]
      someNeedReconnect: boolean
      nextCursor: ThreadsCursor | null
    }

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; data: EmailsResponse }

/** Starts Google's consent screen and comes back to this lead after. */
function connectGoogle() {
  // A full page load, not a router push: the API route redirects to Google.
  const url = new URL('/api/auth/google', window.location.origin)
  url.searchParams.set(
    'returnTo',
    `${window.location.pathname}${window.location.search}`
  )
  window.location.assign(url.href)
}

function threadKey(thread: GmailThreadSummary) {
  return `${thread.accountEmail ?? ''}:${thread.id}`
}

function threadDetail(thread: GmailThreadSummary) {
  const messages =
    thread.messageCount === 1 ? '1 message' : `${thread.messageCount} messages`
  return [thread.lastFrom, formatRelativeTime(thread.lastAt), messages]
    .filter(Boolean)
    .join(' · ')
}

/**
 * The viewer's own Gmail threads with the lead's contact. Read live from
 * their Google account each time the sheet opens; each person sees only
 * their own mail, never a teammate's.
 */
export function LeadEmailsSection({ lead }: { lead: LeadRecord }) {
  const { role } = useViewerAccess()
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [disconnecting, setDisconnecting] = useState(false)
  // Pages after the first, appended in place by "Load more".
  const [more, setMore] = useState<GmailThreadSummary[]>([])
  const [cursor, setCursor] = useState<ThreadsCursor | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const contactEmail = lead.contactEmail
  // Admins manage their Google account in Settings, where it also feeds
  // agency integrations; everyone else disconnects it here.
  const canDisconnectHere = !roleCan(role, 'integrations.manage')

  const disconnect = useCallback((account: GmailAccount) => {
    setDisconnecting(true)
    fetch('/api/integrations/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: account.id }),
    })
      .catch(error => console.error('Failed to disconnect Google:', error))
      .finally(() => {
        setDisconnecting(false)
        setLoad({ kind: 'loading' })
        setReloadKey(key => key + 1)
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    // Promise-chained so every setState runs after the effect.
    fetch(`/api/leads/${lead.id}/emails`)
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as EmailsResponse
        if (cancelled) return
        setLoad({ kind: 'loaded', data })
        setMore([])
        setMoreFailed(false)
        setCursor(data.state === 'ok' ? data.nextCursor : null)
      })
      .catch(error => {
        console.error('Failed to fetch lead emails:', error)
        if (!cancelled) setLoad({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
    // The saved address is what the server searches for.
  }, [lead.id, contactEmail, reloadKey])

  const loadMore = useCallback(() => {
    if (!cursor) return
    setLoadingMore(true)
    setMoreFailed(false)
    const url = new URL(`/api/leads/${lead.id}/emails`, window.location.origin)
    url.searchParams.set('cursor', JSON.stringify(cursor))
    fetch(url.href)
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as EmailsResponse
        if (data.state !== 'ok') throw new Error(`Gmail answered ${data.state}`)
        setMore(current => [...current, ...data.threads])
        setCursor(data.nextCursor)
      })
      .catch(error => {
        console.error('Failed to load more lead emails:', error)
        setMoreFailed(true)
      })
      .finally(() => setLoadingMore(false))
  }, [cursor, lead.id])

  const data = load.kind === 'loaded' ? load.data : null
  if (data?.state === 'not_allowed') return null

  const who = lead.contactName || contactEmail || 'this person'
  const firstPage = data?.state === 'ok' ? data.threads : []
  // A thread can slide onto the next page when new mail arrives; show it once.
  const seen = new Set(firstPage.map(threadKey))
  const threads = [
    ...firstPage,
    ...more.filter(thread => {
      const key = threadKey(thread)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  ]
  const accounts =
    data?.state === 'ok' || data?.state === 'reconnect' ? data.accounts : []

  const showReconnect = data?.state === 'ok' && data.someNeedReconnect
  const showDisconnect = canDisconnectHere && accounts.length === 1

  let status: ReactNode
  if (load.kind === 'loading') {
    status = (
      <div className='space-y-2'>
        <Skeleton className='h-11 w-full' />
        <Skeleton className='h-11 w-full' />
      </div>
    )
  } else if (load.kind === 'error') {
    status = (
      <EmptyState message='Couldn’t load emails from Gmail. Try again later.' />
    )
  } else if (data?.state === 'not_connected') {
    status = (
      <EmptyState
        message={`Connect your Google account to see your emails with ${who}. Only you see them.`}
        action={
          <Button variant='outline' size='sm' onClick={connectGoogle}>
            Connect Google
          </Button>
        }
      />
    )
  } else if (data?.state === 'reconnect') {
    status = (
      <EmptyState
        message='Your Google connection has expired. Reconnect it to see your emails.'
        action={
          <Button variant='outline' size='sm' onClick={connectGoogle}>
            Reconnect Google
          </Button>
        }
      />
    )
  } else if (data?.state === 'no_email') {
    status = (
      <EmptyState
        message={`Add an email for ${who} to see your emails with them.`}
      />
    )
  }

  return (
    <EntityList
      title='Email threads'
      icon={Mail}
      titleAddon={
        threads.length > 0 ? (
          <Badge variant='secondary'>
            {cursor ? `${threads.length}+` : threads.length}
          </Badge>
        ) : null
      }
      isEmpty={threads.length === 0}
      emptyMessage={`No emails with ${contactEmail ?? who} in your Gmail.`}
      status={status}
      footer={
        showReconnect || showDisconnect ? (
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
            {showReconnect ? (
              <Button
                variant='link'
                size='xs'
                className='h-auto p-0 text-xs'
                onClick={connectGoogle}
              >
                Reconnect an expired account
              </Button>
            ) : null}
            {showDisconnect ? (
              <Button
                variant='link'
                size='xs'
                className='text-muted-foreground h-auto p-0 text-xs'
                disabled={disconnecting}
                onClick={() => disconnect(accounts[0])}
              >
                Disconnect
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {threads.map(thread => (
        <SheetRecordRow
          key={threadKey(thread)}
          icon={Mail}
          title={thread.subject}
          description={threadDetail(thread)}
          href={thread.url}
          external
          openLabel={`Open “${thread.subject}” in Gmail`}
        />
      ))}
      {cursor ? (
        <div>
          {moreFailed ? (
            <p className='text-destructive px-2 pb-1 text-xs'>
              Couldn’t load more from Gmail. Try again.
            </p>
          ) : null}
          <LoadMoreButton onClick={loadMore} loading={loadingMore} />
        </div>
      ) : null}
    </EntityList>
  )
}
