'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@pts/ui/button'

type LoadMoreButtonProps = {
  onClick: () => void
  loading: boolean
  /** "Load 5 more" when the count is known; "Load more" otherwise. */
  label?: string
}

/**
 * The one "load the next page" control: a quiet full-width row with a
 * spinner while it loads. The home widgets and the lead sheet's Email
 * threads use it, so every list grows the same way.
 */
export function LoadMoreButton({
  onClick,
  loading,
  label = 'Load more',
}: LoadMoreButtonProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='xs'
      className='w-full'
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className='h-3.5 w-3.5 animate-spin' aria-hidden />
          Loading...
        </>
      ) : (
        label
      )}
    </Button>
  )
}
