'use client'

import { useState } from 'react'

import { Button } from '@pts/ui/button'
import { SaveConflictDialog } from '@/components/sheets/save-conflict-dialog'
import {
  SheetSaveNotice,
  SheetViewers,
} from '@/components/sheets/sheet-presence'
import type { SheetViewer } from '@/lib/sheets/presence/use-sheet-presence'
import type { SaveConflict } from '@/lib/sheets/save-conflict/types'
import type { SaveConflictGuard } from '@/lib/sheets/save-conflict/use-save-conflict'

import { Specimen } from './specimen'

const KRIS: SheetViewer = {
  userId: 'design-kris',
  name: 'Kris Crawford',
  hasPhoto: false,
  editing: false,
}

const SAMPLE_CONFLICT: SaveConflict = {
  savedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  changes: [
    {
      by: 'Kris Crawford',
      summary: 'Updated company "Acme" (website)',
      at: new Date(Date.now() - 2 * 60_000).toISOString(),
    },
  ],
}

/** A guard that only opens and closes the dialog, for the specimen. */
function useSampleGuard(): [SaveConflictGuard, () => void] {
  const [conflict, setConflict] = useState<SaveConflict | null>(null)
  const guard: SaveConflictGuard = {
    seed: () => {},
    saved: () => {},
    onSaved: () => () => {},
    expected: () => undefined,
    catchConflict: () => false,
    conflict,
    dismiss: () => setConflict(null),
    overwrite: () => {
      setConflict(null)
      return 'close'
    },
  }
  return [guard, () => setConflict(SAMPLE_CONFLICT)]
}

/** Who else has a record open, and a save someone made first. */
export function SheetConflictSpecimens() {
  const [guard, openDialog] = useSampleGuard()
  return (
    <>
      <Specimen
        label='Who else is here'
        note='SheetPresence, above the first field'
      >
        <div className='flex flex-col gap-3'>
          <SheetViewers noun='company' others={[KRIS]} />
          <SheetViewers noun='company' others={[{ ...KRIS, editing: true }]} />
        </div>
      </Specimen>
      <Specimen
        label='They saved while you were editing'
        note='SheetPresence’s warning, in its place above the first field'
      >
        <SheetSaveNotice
          noun='company'
          theirSave={{
            userId: KRIS.userId,
            name: KRIS.name,
            mine: false,
            version: SAMPLE_CONFLICT.savedAt,
          }}
          onLoadTheirs={() => {}}
        />
      </Specimen>
      <Specimen
        label='Someone saved first'
        note='SaveConflictDialog, opened by a refused Save'
      >
        <Button type='button' variant='outline' onClick={openDialog}>
          Show the dialog
        </Button>
        <SaveConflictDialog
          guard={guard}
          noun='company'
          onOverwrite={() => {}}
          onLoadTheirs={guard.dismiss}
        />
      </Specimen>
    </>
  )
}
