'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getProjectStatusLabel,
  getProjectStatusToken,
  PROJECT_STATUS_OPTIONS,
  type ProjectStatusValue,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

export type ProjectStatusCellProps = {
  projectId: string
  status: ProjectStatusValue | string
  onStatusChange: (
    projectId: string,
    status: ProjectStatusValue
  ) => Promise<void>
  disabled?: boolean
  className?: string
  variant?: 'table' | 'standalone'
}

export function ProjectStatusCell({
  projectId,
  status,
  onStatusChange,
  disabled,
  className,
  variant = 'table',
}: ProjectStatusCellProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState(status)
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (value: ProjectStatusValue) => {
    if (value === optimisticStatus) {
      setIsOpen(false)
      return
    }

    setOptimisticStatus(value)
    setIsOpen(false)

    startTransition(async () => {
      try {
        await onStatusChange(projectId, value)
      } catch {
        setOptimisticStatus(status)
      }
    })
  }

  const currentLabel = getProjectStatusLabel(optimisticStatus)
  const currentToken = getProjectStatusToken(optimisticStatus)

  if (disabled) {
    return (
      <Badge className={cn('text-xs', currentToken, className)}>
        {currentLabel}
      </Badge>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        className={cn(
          'group focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1.5 rounded-md focus:outline-none focus-visible:ring-2',
          variant === 'table' && 'hover:bg-accent/60 -mx-1 p-1',
          variant === 'standalone' &&
            'bg-background/20 hover:border-border border border-transparent p-1.5 transition-colors',
          className
        )}
        disabled={isPending}
      >
        <Badge className={cn('text-xs', currentToken)}>
          {currentLabel}
          {isPending ? <Loader2 className='mr-1 h-3 w-3 animate-spin' /> : null}
        </Badge>
        <ChevronDown
          className={cn(
            'text-foreground/70 h-3.5 w-3.5',
            variant === 'table' &&
              'opacity-0 transition-opacity group-hover:opacity-100'
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start'>
        {PROJECT_STATUS_OPTIONS.map(option => {
          const optionToken = getProjectStatusToken(option.value)
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
