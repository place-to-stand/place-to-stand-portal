'use client'

import { useState } from 'react'
import { Loader2, Trash2, Plus, RefreshCw } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Button } from '@pts/ui/button'
import { Badge } from '@pts/ui/badge'
import { formatCalendarDate } from '@pts/ui/dates'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { EmptyState } from '@pts/ui/empty-state'
import { RowActionButton } from '@pts/ui/row-action-button'

const PROVIDER_NAMES = {
  google: 'Google',
  github: 'GitHub',
  vercel: 'Vercel',
  supabase: 'Supabase',
} as const

export interface ConnectedAccount {
  id: string
  email: string | null
  displayName: string | null
  status: string
  login?: string // GitHub username
  lastSyncAt?: string | null
  connectedAt: string
  metadata?: {
    picture?: string
    avatar_url?: string
    name?: string
  }
}

interface ConnectedAccountsListProps {
  provider: 'google' | 'github' | 'vercel' | 'supabase'
  accounts: ConnectedAccount[]
  onDisconnect: (id: string) => Promise<void>
  onAddAccount: () => void
  onUpdatePermissions?: () => void
  isDisconnecting?: string
}

export function ConnectedAccountsList({
  provider,
  accounts,
  onDisconnect,
  onAddAccount,
  onUpdatePermissions,
  isDisconnecting,
}: ConnectedAccountsListProps) {
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<ConnectedAccount | null>(null)

  const handleDisconnectClick = (account: ConnectedAccount) => {
    setAccountToDisconnect(account)
    setConfirmDialogOpen(true)
  }

  const handleConfirmDisconnect = async () => {
    if (!accountToDisconnect) return

    setDisconnectingId(accountToDisconnect.id)
    setConfirmDialogOpen(false)
    try {
      await onDisconnect(accountToDisconnect.id)
    } finally {
      setDisconnectingId(null)
      setAccountToDisconnect(null)
    }
  }

  const handleCancelDisconnect = () => {
    setConfirmDialogOpen(false)
    setAccountToDisconnect(null)
  }

  const getAvatarUrl = (account: ConnectedAccount) => {
    if (provider === 'google') {
      return account.metadata?.picture
    }
    return account.metadata?.avatar_url
  }

  const getDisplayLabel = (account: ConnectedAccount) => {
    if (provider === 'github' && account.login) {
      return `@${account.login}`
    }
    return account.displayName || account.email || 'Unknown'
  }

  const getInitials = (account: ConnectedAccount) => {
    const name = account.displayName || account.email || '?'
    return name[0].toUpperCase()
  }

  const formatDate = (dateString: string) =>
    formatCalendarDate(dateString) ?? '—'

  const providerName = PROVIDER_NAMES[provider]
  const activeAccounts = accounts.filter(a => a.status === 'ACTIVE')

  if (activeAccounts.length === 0) {
    return (
      <EmptyState
        message={`No ${providerName} accounts connected.`}
        action={
          <Button onClick={onAddAccount} variant='outline' size='sm'>
            <Plus />
            Connect {providerName} account
          </Button>
        }
      />
    )
  }

  return (
    <>
      <div className='space-y-3'>
        {activeAccounts.map(account => {
          const isCurrentlyDisconnecting =
            disconnectingId === account.id || isDisconnecting === account.id

          return (
            <div
              key={account.id}
              className='flex items-center justify-between rounded-lg border p-3'
            >
              <div className='flex items-center gap-3'>
                <Avatar size='lg'>
                  <AvatarImage src={getAvatarUrl(account)} />
                  <AvatarFallback>{getInitials(account)}</AvatarFallback>
                </Avatar>
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>
                    {getDisplayLabel(account)}
                  </span>
                  {account.email && provider === 'github' && (
                    <span className='text-muted-foreground text-xs'>
                      {account.email}
                    </span>
                  )}
                  <span className='text-muted-foreground text-xs'>
                    Connected {formatDate(account.connectedAt)}
                  </span>
                </div>
              </div>

              <div className='flex items-center gap-2'>
                <Badge
                  variant={
                    account.status === 'ACTIVE' ? 'default' : 'secondary'
                  }
                  className='text-xs'
                >
                  {account.status === 'ACTIVE' ? 'Active' : account.status}
                </Badge>

                {onUpdatePermissions && (
                  <RowActionButton
                    label='Update permissions'
                    icon={<RefreshCw />}
                    className='text-muted-foreground hover:text-foreground'
                    onClick={onUpdatePermissions}
                  />
                )}

                <RowActionButton
                  label='Disconnect account'
                  icon={
                    isCurrentlyDisconnecting ? (
                      <Loader2 className='animate-spin' />
                    ) : (
                      <Trash2 />
                    )
                  }
                  className='text-muted-foreground hover:text-destructive'
                  disabled={isCurrentlyDisconnecting}
                  onClick={() => handleDisconnectClick(account)}
                />
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={confirmDialogOpen}
        title='Disconnect account?'
        description={
          accountToDisconnect
            ? `Are you sure you want to disconnect ${getDisplayLabel(accountToDisconnect)}? This will revoke access to this ${providerName} account.`
            : ''
        }
        confirmLabel='Disconnect'
        confirmVariant='destructive'
        onConfirm={handleConfirmDisconnect}
        onCancel={handleCancelDisconnect}
      />
    </>
  )
}
