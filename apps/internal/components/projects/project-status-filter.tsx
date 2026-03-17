'use client'

import { Check, ChevronDown, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  getProjectStatusLabel,
  getProjectStatusToken,
  PROJECT_STATUS_OPTIONS,
  type ProjectStatusValue,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

export const DEFAULT_STATUS_FILTER: ProjectStatusValue[] = ['ONBOARDING', 'ACTIVE']

export type ProjectStatusFilterProps = {
  selectedStatuses: ProjectStatusValue[]
  onSelectionChange: (statuses: ProjectStatusValue[]) => void
  className?: string
}

export function ProjectStatusFilter({
  selectedStatuses,
  onSelectionChange,
  className,
}: ProjectStatusFilterProps) {
  const allStatuses = PROJECT_STATUS_OPTIONS.map(o => o.value)
  const allSelected = selectedStatuses.length === allStatuses.length

  const toggleStatus = (status: ProjectStatusValue) => {
    if (selectedStatuses.includes(status)) {
      onSelectionChange(selectedStatuses.filter(s => s !== status))
    } else {
      onSelectionChange([...selectedStatuses, status])
    }
  }

  const selectAll = () => {
    onSelectionChange([...allStatuses])
  }

  const clearAll = () => {
    onSelectionChange([])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          className={cn(
            'h-auto min-h-9 w-full justify-start gap-2 px-3 py-1.5 sm:w-auto',
            className
          )}
        >
          <span className='text-muted-foreground text-sm font-normal'>
            Status:
          </span>
          {selectedStatuses.length === 0 ? (
            <span className='text-muted-foreground text-sm'>None</span>
          ) : (
            <div className='flex flex-wrap gap-1'>
              {selectedStatuses.map(status => {
                const label = getProjectStatusLabel(status)
                const token = getProjectStatusToken(status)
                return (
                  <Badge key={status} className={cn('text-xs', token)}>
                    {label}
                  </Badge>
                )
              })}
            </div>
          )}
          <ChevronDown className='text-muted-foreground ml-auto h-4 w-4 shrink-0' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-64 p-2'>
        <div className='flex flex-col gap-1'>
          {PROJECT_STATUS_OPTIONS.map(option => {
            const isSelected = selectedStatuses.includes(option.value)
            const token = getProjectStatusToken(option.value)

            return (
              <button
                key={option.value}
                type='button'
                onClick={() => toggleStatus(option.value)}
                className={cn(
                  'hover:bg-accent flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                  isSelected && 'bg-accent/50'
                )}
              >
                <Badge className={cn('text-xs', token)}>{option.label}</Badge>
                {isSelected ? (
                  <Check className='text-primary h-4 w-4' />
                ) : null}
              </button>
            )
          })}
        </div>
        <div className='border-border mt-2 flex items-center justify-between gap-2 border-t pt-2'>
          <button
            type='button'
            onClick={clearAll}
            disabled={selectedStatuses.length === 0}
            className='text-muted-foreground hover:text-foreground inline-flex items-center text-xs transition-colors disabled:pointer-events-none disabled:opacity-50'
          >
            <X className='mr-0.5 h-3 w-3' />
            Clear
          </button>
          <button
            type='button'
            onClick={selectAll}
            disabled={allSelected}
            className='text-muted-foreground hover:text-foreground inline-flex items-center text-xs transition-colors disabled:pointer-events-none disabled:opacity-50'
          >
            <Check className='mr-0.5 h-3 w-3' />
            Select all
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
