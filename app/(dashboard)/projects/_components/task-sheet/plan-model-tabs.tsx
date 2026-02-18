'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Thread = {
  id: string
  model: string
  modelLabel: string
  currentVersion: number
}

const MODEL_OPTIONS = [
  { model: 'claude-sonnet-4.6', label: 'Sonnet 4.6' },
  { model: 'claude-opus-4.6', label: 'Opus 4.6' },
  { model: 'claude-haiku-4.5', label: 'Haiku 4.5' },
] as const

type PlanModelTabsProps = {
  threads: Thread[]
  activeThreadId: string | null
  onSelectThread: (threadId: string) => void
  onAddThread: (model: string, modelLabel: string) => void
  disabled?: boolean
}

export function PlanModelTabs({
  threads,
  activeThreadId,
  onSelectThread,
  onAddThread,
  disabled,
}: PlanModelTabsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Filter out models that already have threads
  const existingModels = new Set(threads.map(t => t.model))
  const availableModels = MODEL_OPTIONS.filter(m => !existingModels.has(m.model))

  return (
    <div className='flex items-center gap-1'>
      {threads.map(thread => (
        <button
          key={thread.id}
          onClick={() => onSelectThread(thread.id)}
          disabled={disabled}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            thread.id === activeThreadId
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          )}
        >
          {thread.modelLabel}
          {thread.currentVersion > 0 && (
            <span className='ml-1 opacity-60'>v{thread.currentVersion}</span>
          )}
        </button>
      ))}

      {availableModels.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='h-6 w-6'
              disabled={disabled}
            >
              <Plus className='h-3.5 w-3.5' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-36 p-1' align='start'>
            {availableModels.map(opt => (
              <button
                key={opt.model}
                className='w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted'
                onClick={() => {
                  onAddThread(opt.model, opt.label)
                  setPopoverOpen(false)
                }}
              >
                {opt.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
