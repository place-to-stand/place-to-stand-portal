'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { Alert, AlertContent, AlertDescription } from '@pts/ui/alert'
import { InlineReveal } from '@/components/ui/inline-reveal'
import { PersonAvatar } from '@/components/ui/user-avatar'
import type { SheetEntityKey } from '@/lib/sheets/entities'
import {
  type SheetViewer,
  useSheetPresence,
} from '@/lib/sheets/presence/use-sheet-presence'
import type { SaveConflictGuard } from '@/lib/sheets/save-conflict/use-save-conflict'

import { useSheetNoticeSlot } from './sheet-notice-slot'

type SheetPresenceProps = {
  entity: SheetEntityKey
  /** What the sheet edits, in lower case: "company", "task". */
  noun: string
  recordId: string | null
  open: boolean
  isDirty: boolean
  guard: SaveConflictGuard
  /** Same as the conflict dialog's: drop edits, show the record as it is. */
  onLoadTheirs: () => void
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Who else has the record open, as a yellow alert above the form's first
 * field. When one of them saves, an untouched sheet just takes their save;
 * one with edits keeps them, and its next Save opens the conflict dialog.
 * Renders nothing when the sheet is the only one open.
 */
export function SheetPresence({
  entity,
  noun,
  recordId,
  open,
  isDirty,
  guard,
  onLoadTheirs,
}: SheetPresenceProps) {
  const { others, theirSave, clearTheirSave } = useSheetPresence({
    entity,
    recordId,
    open,
    isDirty,
    guard,
  })

  // Nothing of ours to lose: follow their save quietly.
  useEffect(() => {
    if (!theirSave || isDirty) return
    clearTheirSave()
    onLoadTheirs()
  }, [theirSave, isDirty, clearTheirSave, onLoadTheirs])

  // The alert eases in when someone arrives and out when the last one
  // leaves, so it catches the eye. It mounts closed and opens a frame later
  // (or there is nothing to animate from), and stays mounted with the last
  // viewers until the closing ease ends.
  const present = others.length > 0
  const [shown, setShown] = useState<SheetViewer[]>([])
  const [revealed, setRevealed] = useState(false)
  if (present && shown !== others) setShown(others)
  useEffect(() => {
    if (present) {
      const frame = requestAnimationFrame(() => setRevealed(true))
      return () => cancelAnimationFrame(frame)
    }
    const timer = setTimeout(() => {
      setRevealed(false)
      setShown([])
    }, REVEAL_MS + 50)
    return () => clearTimeout(timer)
  }, [present])

  const noticeSlot = useSheetNoticeSlot()
  if (!noticeSlot || shown.length === 0) return null
  return createPortal(
    <InlineReveal open={present && revealed}>
      {/* The space under the alert eases with it; the slot cancels the
          form's own gap (see SheetNoticeSlot). */}
      <div className='pb-6'>
        <SheetViewers noun={noun} others={shown} />
      </div>
    </InlineReveal>,
    noticeSlot
  )
}

/** InlineReveal's ease. */
const REVEAL_MS = 200

/**
 * Who else has the record open: their avatars and one line, "Kris Crawford
 * is editing this company". Nothing when no one else is here. Also the
 * /design specimen.
 */
export function SheetViewers({
  noun,
  others,
}: {
  noun: string
  others: SheetViewer[]
}) {
  if (others.length === 0) return null

  const editors = others.filter(viewer => viewer.editing)
  const shown = editors.length > 0 ? editors : others
  const names = joinNames(shown.map(viewer => viewer.name))
  const one = shown.length === 1
  const text =
    editors.length > 0
      ? `${names} ${one ? 'is' : 'are'} editing this ${noun}.`
      : `${names} ${one ? 'has' : 'have'} this ${noun} open.`

  return (
    <Alert variant='warning' role='status'>
      <span className='flex h-[1lh] shrink-0 items-center -space-x-1.5'>
        {others.map(viewer => (
          <PersonAvatar
            key={viewer.userId}
            userId={viewer.userId}
            name={viewer.name}
            hasPhoto={viewer.hasPhoto}
            size='sm'
          />
        ))}
      </span>
      <AlertContent>
        <AlertDescription>{text}</AlertDescription>
      </AlertContent>
    </Alert>
  )
}
