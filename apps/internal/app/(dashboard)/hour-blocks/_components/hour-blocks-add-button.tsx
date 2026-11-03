'use client'

import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { HOUR_BLOCK_MISSING_CLIENT_REASON } from '@/lib/hour-blocks/hour-block-ui-state'

type HourBlocksAddButtonProps = {
  /** Whether any company is or was a client. */
  hasClients: boolean
  className?: string
}

/** "Create hour block" needs a client to attach to, so it waits for the first one. */
export function HourBlocksAddButton({
  hasClients,
  className,
}: HourBlocksAddButtonProps) {
  return (
    <SheetCreateButton
      entity='hour-block'
      label='Create hour block'
      className={className}
      disabledReason={!hasClients ? HOUR_BLOCK_MISSING_CLIENT_REASON : null}
    />
  )
}
