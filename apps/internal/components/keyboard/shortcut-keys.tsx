'use client'

import { Fragment, useSyncExternalStore } from 'react'

import { Kbd } from '@pts/ui/kbd'

import { detectMac, formatShortcut } from '@/lib/keyboard/format'
import type { Shortcut } from '@/lib/keyboard/shortcuts'

const noopSubscribe = () => () => {}

/**
 * ⌘ on a Mac, Ctrl elsewhere. The server renders the Mac labels (the whole
 * team is on Macs), and other platforms switch after hydration.
 */
export function useIsMac(): boolean {
  return useSyncExternalStore(noopSubscribe, detectMac, () => true)
}

type Props = {
  shortcut: Shortcut
  size?: 'default' | 'sm'
  /** Leave out the alternatives (`Ctrl+Y` for redo) where space is tight. */
  primaryOnly?: boolean
  className?: string
  /** Extra classes for each key chip (e.g. inverted inside a solid button). */
  kbdClassName?: string
}

/** A registry shortcut as key chips, in the viewer's platform labels. */
export function ShortcutKeys({
  shortcut,
  size = 'default',
  primaryOnly = false,
  className,
  kbdClassName,
}: Props) {
  const isMac = useIsMac()
  const combos = primaryOnly
    ? [shortcut.keys]
    : [shortcut.keys, ...(shortcut.alternatives ?? [])]

  return (
    <span className={className}>
      {combos.map((keys, index) => (
        <Fragment key={keys}>
          {index > 0 ? (
            <span className='text-muted-foreground mx-1 text-xs'>or</span>
          ) : null}
          <Kbd size={size} className={kbdClassName}>
            {formatShortcut(keys, isMac)}
          </Kbd>
        </Fragment>
      ))}
    </span>
  )
}
