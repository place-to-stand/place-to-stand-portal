'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Mail } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { formatRelativeTime } from '@pts/ui/dates'
import { EmptyState } from '@pts/ui/empty-state'
import { Skeleton } from '@pts/ui/skeleton'
import { EntityList } from '@/components/sheets/entity-list'
import { SheetRecordRow } from '@/components/sheets/sheet-record-row'
import type { GmailThreadSummary } from '@/lib/gmail/threads-utils'
import type { LeadRecord } from '@/lib/leads/types'

type EmailsResponse =
  | { state: 'not_allowed' | 'no_email' | 'not_connected' | 'reconnect' }
  | { state: 'ok'; threads: GmailThreadSummary[] }

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
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const contactEmail = lead.contactEmail

  useEffect(() => {
    let cancelled = false
    // Promise-chained so every setState runs after the effect.
    fetch(`/api/leads/${lead.id}/emails`)
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as EmailsResponse
        if (!cancelled) setLoad({ kind: 'loaded', data })
      })
      .catch(error => {
        console.error('Failed to fetch lead emails:', error)
        if (!cancelled) setLoad({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
    // The saved address is what the server searches for.
  }, [lead.id, contactEmail])

  const data = load.kind === 'loaded' ? load.data : null
  if (data?.state === 'not_allowed') return null

  const who = lead.contactName || contactEmail || 'this contact'
  const threads = data?.state === 'ok' ? data.threads : []

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
        label='Connect Google'
        onClick={connectGoogle}
      />
    )
  } else if (data?.state === 'reconnect') {
    status = (
      <EmptyState
        message='Your Google connection has expired. Reconnect it to see your emails.'
        label='Reconnect Google'
        onClick={connectGoogle}
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
      title='Emails'
      icon={Mail}
      titleAddon={
        threads.length > 0 ? (
          <Badge variant='secondary'>{threads.length}</Badge>
        ) : null
      }
      isEmpty={threads.length === 0}
      emptyMessage={`No emails with ${contactEmail ?? who} in your Gmail.`}
      status={status}
    >
      {threads.map(thread => (
        <SheetRecordRow
          key={`${thread.accountEmail ?? ''}:${thread.id}`}
          icon={Mail}
          title={thread.subject}
          description={threadDetail(thread)}
          href={thread.url}
          external
          openLabel={`Open “${thread.subject}” in Gmail`}
        />
      ))}
    </EntityList>
  )
}
