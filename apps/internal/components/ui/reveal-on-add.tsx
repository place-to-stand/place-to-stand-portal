'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Ids in `ids` that weren't there before: rows the person just added. The
 * first list (the sheet loading) and a list that's all new (the sheet
 * switching to another record) count as loaded, not added.
 */
export function useAddedIds(ids: readonly string[]) {
  // Adjusted during render (not in an effect) so a new row mounts already
  // knowing it's new.
  const [seen, setSeen] = useState<readonly string[] | null>(null)
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set())

  if (seen !== ids) {
    if (seen) {
      const previous = new Set(seen)
      const fresh = ids.filter(id => !previous.has(id))
      // Nothing kept from before: a load, not an add.
      if (fresh.length && fresh.length < ids.length) {
        setAdded(new Set([...added, ...fresh]))
      }
    }
    setSeen(ids)
  }

  return added
}

/**
 * Eases a just-added row open (height and opacity, 200ms ease-out, like
 * `InlineReveal`) instead of letting it jump in. With `animate` off it
 * renders as is. Reduced motion: it just appears.
 */
export function RevealOnAdd({
  animate,
  children,
}: {
  animate: boolean
  children: ReactNode
}) {
  // Reduced motion (or nothing to animate): shown as is from the start.
  const [still] = useState(
    () =>
      !animate ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  )
  const [open, setOpen] = useState(still)
  const [settled, setSettled] = useState(still)

  useEffect(() => {
    if (still) return
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [still])

  // The same two elements throughout, so the row's fields never remount.
  return (
    <div
      className={cn(
        !settled &&
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
        !settled &&
          (open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')
      )}
      // Once open, stop clipping (focus rings, the drag lift).
      onTransitionEnd={event => {
        if (open && event.target === event.currentTarget) setSettled(true)
      }}
    >
      <div className={cn(!settled && 'min-h-0 overflow-hidden')}>
        {children}
      </div>
    </div>
  )
}
