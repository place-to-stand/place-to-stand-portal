'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { HourBlockSheet } from '../hour-block-sheet'
import type { ClientRow } from '@/lib/settings/hour-blocks/hour-block-form'
import { cn } from '@/lib/utils'

type HourBlocksAddButtonProps = {
  clients: ClientRow[]
  className?: string
}

export function HourBlocksAddButton({
  clients,
  className,
}: HourBlocksAddButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleComplete = () => {
    setOpen(false)
    router.refresh()
  }

  const sortedClients = [...clients].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  const createDisabled = sortedClients.length === 0
  const createDisabledReason = createDisabled
    ? 'Add a client before creating an hour block.'
    : null

  return (
    <div className={cn(className)}>
      <DisabledFieldTooltip
        disabled={createDisabled}
        reason={createDisabledReason}
      >
        <Button
          size='sm'
          type='button'
          onClick={() => setOpen(true)}
          disabled={createDisabled}
          className='gap-2'
        >
          <Plus className='h-4 w-4' />
          Add hour block
        </Button>
      </DisabledFieldTooltip>
      <HourBlockSheet
        open={open}
        onOpenChange={setOpen}
        onComplete={handleComplete}
        hourBlock={null}
        clients={sortedClients}
      />
    </div>
  )
}
