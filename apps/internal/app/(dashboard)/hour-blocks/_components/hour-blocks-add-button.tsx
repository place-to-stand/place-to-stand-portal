'use client'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { HOUR_BLOCK_MISSING_CLIENT_REASON } from '@/lib/settings/hour-blocks/hour-block-ui-state'
import type { ClientRow } from '@/lib/settings/hour-blocks/hour-block-form'

type HourBlocksAddButtonProps = {
  clients: ClientRow[]
  className?: string
}

/** "Create hour block" needs a client to attach to, so it waits for the first one. */
export function HourBlocksAddButton({
  clients,
  className,
}: HourBlocksAddButtonProps) {
  return (
    <SheetCreateButton
      entity='hour-block'
      label='Create hour block'
      className={className}
      disabledReason={
        clients.length === 0 ? HOUR_BLOCK_MISSING_CLIENT_REASON : null
      }
    />
  )
}
