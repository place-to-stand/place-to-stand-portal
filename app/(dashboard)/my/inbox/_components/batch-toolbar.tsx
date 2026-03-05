'use client'

import { useState } from 'react'
import { Sparkles, X, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface BatchToolbarProps {
  selectedCount: number
  onAnalyze: () => void
  onDismiss: () => Promise<void>
  onClear: () => void
}

export function BatchToolbar({ selectedCount, onAnalyze, onDismiss, onClear }: BatchToolbarProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (selectedCount === 0) return null

  const handleDismiss = async () => {
    setIsSubmitting(true)
    try {
      await onDismiss()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='bg-background fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2.5 shadow-lg'>
      <div className='flex items-center gap-3'>
        <span className='text-sm font-medium'>
          {selectedCount} selected
        </span>
        <Button
          variant='outline'
          size='sm'
          onClick={onAnalyze}
          disabled={isSubmitting}
        >
          <Sparkles className='mr-1.5 h-3.5 w-3.5' />
          Analyze {selectedCount} thread{selectedCount !== 1 ? 's' : ''}
        </Button>
        <Button
          variant='destructive'
          size='sm'
          onClick={handleDismiss}
          disabled={isSubmitting}
        >
          <XCircle className='mr-1.5 h-3.5 w-3.5' />
          Dismiss {selectedCount} thread{selectedCount !== 1 ? 's' : ''}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={onClear}
          disabled={isSubmitting}
        >
          <X className='mr-1 h-3.5 w-3.5' />
          Clear
        </Button>
      </div>
    </div>
  )
}
