'use client'

import { Fragment, useSyncExternalStore } from 'react'

import { Kbd } from '@pts/ui/kbd'

import { detectMac, formatShortcutKeys } from '@/lib/keyboard/format'
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
}

/**
 * One combination (`mod+shift+s`) as one keycap per key: ⇧ ⌘ S on a Mac,
 * Ctrl Shift S elsewhere. Separate caps read without a `+` between them, the
 * way GitHub, Linear and Vercel show keys.
 */
export function KeyCaps({
  keys,
  size = 'default',
}: {
  keys: string
  size?: 'default' | 'sm'
}) {
  const isMac = useIsMac()
  return (
    <span className='inline-flex items-center gap-0.5 align-middle'>
      {formatShortcutKeys(keys, isMac).map((key, index) => (
        <Kbd key={index} size={size}>
          {key}
        </Kbd>
      ))}
    </span>
  )
}

/** A registry shortcut as key chips, in the viewer's platform labels. */
export function ShortcutKeys({
  shortcut,
  size = 'default',
  primaryOnly = false,
  className,
}: Props) {
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
          <KeyCaps keys={keys} size={size} />
        </Fragment>
      ))}
    </span>
  )
}
