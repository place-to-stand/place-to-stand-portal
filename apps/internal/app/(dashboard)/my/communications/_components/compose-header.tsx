'use client'

import { format } from 'date-fns'
import { X, Check, Cloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ComposeMode } from './compose-panel'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface ComposeHeaderProps {
  mode: ComposeMode
  inline?: boolean
  hideCloseButton?: boolean
  enableAutoSave?: boolean
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  onClose: () => void
}

export function ComposeHeader({
  mode,
  inline,
  hideCloseButton,
  enableAutoSave,
  saveStatus,
  lastSavedAt,
  onClose,
}: ComposeHeaderProps) {
  const modeLabel =
    mode === 'reply'
      ? 'Reply'
      : mode === 'reply_all'
        ? 'Reply All'
        : mode === 'forward'
          ? 'Forward'
          : 'New Email'

  return (
    <div className={cn(
      'flex items-center justify-between border-b',
      inline ? 'px-4 py-2' : 'px-4 py-3'
    )}>
      <div className='flex items-center gap-2'>
        <h3 className='font-semibold'>{modeLabel}</h3>
        {/* Save status indicator */}
        {enableAutoSave && saveStatus !== 'idle' && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              saveStatus === 'saving' && 'text-muted-foreground',
              saveStatus === 'saved' && 'text-green-600',
              saveStatus === 'error' && 'text-destructive'
            )}
          >
            {saveStatus === 'saving' && (
              <>
                <Cloud className='h-3 w-3 animate-pulse' />
                Saving...
              </>
            )}
            {saveStatus === 'saved' && lastSavedAt && (
              <>
                <Check className='h-3 w-3' />
                Saved at {format(lastSavedAt, 'h:mm a')}
              </>
            )}
            {saveStatus === 'error' && 'Save failed'}
          </span>
        )}
      </div>
      {!hideCloseButton && (
        <Button variant='ghost' size='icon' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      )}
    </div>
  )
}
