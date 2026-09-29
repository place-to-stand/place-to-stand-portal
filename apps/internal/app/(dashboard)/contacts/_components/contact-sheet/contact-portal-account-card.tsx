'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { formatCalendarDate, formatRelativeTime } from '@pts/ui/dates'
import { Skeleton } from '@pts/ui/skeleton'
import { LinkedRecordCard } from '@/components/sheets/linked-record-card'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'
import { userSheetHref } from '@/lib/sheets/hrefs'
import { cn } from '@/lib/utils'

import { getContactPortalAccount } from '../../actions'

type ContactPortalAccountCardProps = {
  /** `contacts.user_id`. Key the card on it so a new id starts from loading. */
  userId: string
}

const ACCESS_STATES = {
  archived: { label: 'Archived', dotClass: 'bg-muted-foreground' },
  disabled: { label: 'Disabled', dotClass: 'bg-amber-500' },
  enabled: { label: 'Enabled', dotClass: 'bg-emerald-500' },
} as const

function AccessValue({ account }: { account: PortalAccountSummary }) {
  const state = account.deletedAt
    ? ACCESS_STATES.archived
    : account.disabledAt
      ? ACCESS_STATES.disabled
      : ACCESS_STATES.enabled

  return (
    <span className='inline-flex items-center gap-1.5'>
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', state.dotClass)}
      />
      {state.label}
    </span>
  )
}

/**
 * The portal user a contact was promoted to: who they are, whether they can
 * get in, and whether they ever have. Fetched on open — the contact rows that
 * feed this sheet only carry the user id.
 */
export function ContactPortalAccountCard({
  userId,
}: ContactPortalAccountCardProps) {
  // undefined = loading, null = the id no longer resolves to a user.
  const [account, setAccount] = useState<PortalAccountSummary | null>()

  useEffect(() => {
    let cancelled = false
    getContactPortalAccount(userId)
      .then(result => {
        if (!cancelled) setAccount(result)
      })
      .catch(error => {
        console.error('Failed to load portal account:', error)
        if (!cancelled) setAccount(null)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const openUser = (
    // Navigates to the users list with this user's sheet open, rather than
    // stacking it here.
    <Button variant='outline' size='sm' asChild>
      <Link href={userSheetHref(userId)}>
        <User2 />
        Open user
      </Link>
    </Button>
  )

  if (account === undefined) {
    return (
      <LinkedRecordCard
        icon={User2}
        title='Portal account'
        description={<Skeleton className='h-3 w-40' />}
        action={openUser}
      />
    )
  }

  if (account === null) {
    return (
      <LinkedRecordCard
        icon={User2}
        title='Portal account'
        description='Unable to load account details.'
        action={openUser}
      />
    )
  }

  return (
    <LinkedRecordCard
      icon={User2}
      title={account.fullName || account.email}
      description={account.email}
      details={[
        { label: 'Sign-in', value: <AccessValue account={account} /> },
        {
          label: 'Last sign-in',
          value: formatRelativeTime(account.lastSignInAt) ?? 'Never',
        },
        { label: 'Joined', value: formatCalendarDate(account.createdAt) },
      ]}
      action={openUser}
    />
  )
}
