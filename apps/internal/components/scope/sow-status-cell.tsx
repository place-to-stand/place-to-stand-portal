'use client'

import { useEffect, useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getSowStatusLabel,
  getSowStatusToken,
  SOW_STATUS_OPTIONS,
  type SowStatusValue,
} from '@/lib/scope/sow-status'
import { cn } from '@/lib/utils'

export type SowStatusCellProps = {
  sowId: string
  status: SowStatusValue | string
  onStatusChange: (sowId: string, status: SowStatusValue) => Promise<void>
  disabled?: boolean
}

export function SowStatusCell({
  sowId,
  status,
  onStatusChange,
  disabled,
}: SowStatusCellProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState(status)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setOptimisticStatus(status)
  }, [status])

  const handleSelect = (value: SowStatusValue) => {
    if (value === optimisticStatus) {
      setIsOpen(false)
      return
    }

    setOptimisticStatus(value)
    setIsOpen(false)

    startTransition(async () => {
      try {
        await onStatusChange(sowId, value)
      } catch {
        setOptimisticStatus(status)
      }
    })
  }

  const currentLabel = getSowStatusLabel(optimisticStatus)
  const currentToken = getSowStatusToken(optimisticStatus)

  if (disabled) {
    return (
      <Badge className={cn('text-xs', currentToken)}>{currentLabel}</Badge>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        className='group focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1 rounded-md focus:outline-none focus-visible:ring-2'
        disabled={isPending}
      >
        <Badge className={cn('text-xs', currentToken)}>
          {currentLabel}
          {isPending ? (
            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
          ) : null}
        </Badge>
        <ChevronDown className='text-foreground/70 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start'>
        {SOW_STATUS_OPTIONS.map(option => {
          const optionToken = getSowStatusToken(option.value)
          const isSelected = option.value === optimisticStatus

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn('cursor-pointer', isSelected && 'bg-accent/50')}
            >
              <Badge className={cn('text-xs', optionToken)}>
                {option.label}
              </Badge>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
