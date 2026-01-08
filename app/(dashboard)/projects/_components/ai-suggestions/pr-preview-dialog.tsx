'use client'

/**
 * PR Preview Dialog
 *
 * This component is currently disabled.
 * PR suggestions will be redesigned in a future sprint to be task-based
 * rather than message-based.
 */

import { AlertCircle } from 'lucide-react'

export function PRPreviewDialog() {
  return (
    <div className='flex flex-col items-center justify-center py-12 px-4 text-center'>
      <div className='mb-4 rounded-full bg-amber-100 p-4 dark:bg-amber-500/10'>
        <AlertCircle className='h-8 w-8 text-amber-600 dark:text-amber-400' />
      </div>
      <h3 className='mb-2 text-lg font-semibold'>PR Suggestions Coming Soon</h3>
      <p className='text-sm text-muted-foreground'>
        PR suggestions are being redesigned and will be available in a future update.
      </p>
    </div>
  )
}
