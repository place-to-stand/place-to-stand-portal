'use client'

import { RefreshCw } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { TabsList, TabsTrigger } from '@pts/ui/tabs'
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
        Recent Activity Overview
      </h2>
      <div className='flex items-center gap-1.5'>
        <TabsList className='h-7'>
          {options.map(option => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              title={option.description}
              className='px-2 py-0.5 text-[11px]'
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn('size-4', {
              'animate-spin': isRefreshing,
            })}
            aria-hidden
          />
          <span className='sr-only'>Refresh summary</span>
        </Button>
      </div>
    </header>
  )
}
