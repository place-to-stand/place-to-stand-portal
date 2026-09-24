'use client'

import { RefreshCw } from 'lucide-react'

import { RowActionButton } from '@pts/ui/row-action-button'
import { TabsList, TabsTrigger } from '@pts/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'
import { cn } from '@/lib/utils'

import { TIMEFRAME_OPTIONS, type TimeframeOption } from './constants'

type WidgetControlsProps = {
  options?: readonly TimeframeOption[]
  onRefresh: () => void
  isRefreshing: boolean
}

export function WidgetControls({
  options = TIMEFRAME_OPTIONS,
  onRefresh,
  isRefreshing,
}: WidgetControlsProps) {
  return (
    <header className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5'>
      <h2
        id='recent-activity-overview-heading'
        className='text-sm font-semibold'
      >
        Recent activity overview
      </h2>
      <div className='flex items-center gap-1.5'>
        <TabsList className='h-7'>
          {options.map(option => (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value={option.value}
                  className='px-2 py-0.5 text-xs'
                >
                  {option.label}
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>{option.description}</TooltipContent>
            </Tooltip>
          ))}
        </TabsList>
        <RowActionButton
          type='button'
          label='Refresh summary'
          onClick={onRefresh}
          disabled={isRefreshing}
          icon={
            <RefreshCw
              className={cn({ 'animate-spin': isRefreshing })}
              aria-hidden
            />
          }
        />
      </div>
    </header>
  )
}
