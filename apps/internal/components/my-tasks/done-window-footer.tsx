'use client'

import { useCallback, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { History, Loader2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { DONE_WINDOW_WEEKS } from '@/lib/projects/tasks/done-window'

type DoneWindowFooterProps = {
  /** Current window width in weeks; always a multiple of DONE_WINDOW_WEEKS. */
  doneWeeks: number
  /** Assigned DONE tasks older than the window. Zero hides the control. */
  olderDoneCount: number
}

export function DoneWindowFooter({
  doneWeeks,
  olderDoneCount,
}: DoneWindowFooterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleWiden = useCallback(() => {
    // Read the live query string rather than the captured searchParams
    // snapshot: a sheet opening in the same tick writes its own param from its
    // own snapshot, and whichever navigation lands last would otherwise drop
    // the other's param.
    const params = new URLSearchParams(
      typeof window === 'undefined'
        ? searchParams.toString()
        : window.location.search
    )
    params.set('doneWeeks', String(doneWeeks + DONE_WINDOW_WEEKS))

    startTransition(() => {
      // replace, not push: widening is a view adjustment, and stacking history
      // entries would make Back walk the window shut one step at a time.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }, [doneWeeks, pathname, router, searchParams])

  if (olderDoneCount <= 0) {
    return null
  }

  return (
    <div className='flex flex-col items-center gap-1 pt-1 pb-2'>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='h-7 w-full text-xs'
        onClick={handleWiden}
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className='h-3.5 w-3.5 animate-spin' aria-hidden />
            Loading...
          </>
        ) : (
          <>
            <History className='h-3.5 w-3.5' aria-hidden />
            Load previous two weeks
          </>
        )}
      </Button>
      <span className='text-muted-foreground text-[10px]'>
        {olderDoneCount} older {olderDoneCount === 1 ? 'task' : 'tasks'} hidden
      </span>
    </div>
  )
}
