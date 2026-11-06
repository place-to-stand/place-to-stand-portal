'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { TriangleAlert } from 'lucide-react'

import {
  Alert,
  AlertAction,
  AlertContent,
  AlertDescription,
} from '@pts/ui/alert'
import { Button } from '@pts/ui/button'
import { PersonAvatar } from '@/components/ui/user-avatar'
import type { SheetEntityKey } from '@/lib/sheets/entities'
import {
  type SheetViewer,
  type TheirSave,
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
 * Who else has the record open, in the sheet's title row, and when one of
 * them saves. An untouched sheet just takes their save; one with edits
 * shows a warning under the header with Load theirs, so the conflict
 * dialog is rarely needed. Renders nothing when the sheet is the only one
 * open.
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

  const noticeSlot = useSheetNoticeSlot()
  // One alert above the first field: their save over your edits wins over
  // who else is here.
  const notice =
    isDirty && theirSave ? (
      <SheetSaveNotice
        noun={noun}
        theirSave={theirSave}
        onLoadTheirs={() => {
          clearTheirSave()
          onLoadTheirs()
        }}
      />
    ) : others.length > 0 ? (
      <SheetViewers noun={noun} others={others} />
    ) : null

  return notice && noticeSlot ? createPortal(notice, noticeSlot) : null
}

/** Someone saved while this sheet has unsaved edits. Also the /design specimen. */
export function SheetSaveNotice({
  noun,
  theirSave,
  onLoadTheirs,
}: {
  noun: string
  theirSave: TheirSave
  onLoadTheirs: () => void
}) {
  return (
    <Alert variant='warning'>
      <TriangleAlert />
      <AlertContent>
        <AlertDescription>
          {theirSave.mine
            ? `You saved this ${noun} in another tab. Saving here now would replace that save.`
            : `${theirSave.name} saved this ${noun}. Saving yours now would replace their changes.`}
        </AlertDescription>
      </AlertContent>
      <AlertAction>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={onLoadTheirs}
        >
          Load theirs
        </Button>
      </AlertAction>
    </Alert>
  )
}

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
    <Alert role='status'>
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
