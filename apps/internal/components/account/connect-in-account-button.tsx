'use client'

import { Button } from '@pts/ui/button'

import { openAccountSheet } from '@/lib/account/use-account-sheet'

/**
 * "Connect in Account": opens Account → Integrations over the current sheet,
 * so whatever the person was editing stays put while they connect.
 */
export function ConnectInAccountButton() {
  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      onClick={() => openAccountSheet('integrations')}
    >
      Connect in Account
    </Button>
  )
}
