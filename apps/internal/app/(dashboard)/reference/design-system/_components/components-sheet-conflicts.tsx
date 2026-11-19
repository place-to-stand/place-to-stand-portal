'use client'

import { useState } from 'react'

import { Button } from '@pts/ui/button'
import { SaveConflictDialog } from '@/components/sheets/save-conflict-dialog'
import { SheetViewers } from '@/components/sheets/sheet-presence'
import type { ActivityLogWithActor } from '@/lib/activity/types'
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

const TWO_MINUTES_AGO = new Date(Date.now() - 2 * 60_000).toISOString()

const SAMPLE_CONFLICT: SaveConflict = {
  savedAt: TWO_MINUTES_AGO,
  changes: [
    {
      id: 'design-log',
      verb: 'COMPANY_UPDATED',
      summary: 'Updated company "Acme" (website, notes)',
      target_type: 'COMPANY',
      target_id: 'design-company',
      created_at: TWO_MINUTES_AGO,
      source: 'ADMIN_UI',
      actor: {
        id: KRIS.userId,
        full_name: KRIS.name,
        email: 'kris@example.com',
        avatar_url: null,
      },
      metadata: {
        changedFields: ['website', 'notes'],
        details: {
          before: { website: 'acme.com', notes: 'Call after the launch.' },
          after: {
            website: 'acme.co',
            notes: 'Call after the launch. Ask about the app.',
          },
        },
      },
    } as unknown as ActivityLogWithActor,
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
        label='Someone saved first'
        note='SaveConflictDialog, opened by a refused Save'
      >
        <Button type='button' variant='outline' onClick={openDialog}>
          Show the dialog
        </Button>
        <SaveConflictDialog
          guard={guard}
          noun='company'
          yours={() => ({
            website: 'acme.io',
            notes: 'Call after the launch.',
          })}
          onOverwrite={() => {}}
          onLoadTheirs={guard.dismiss}
        />
      </Specimen>
    </>
  )
}
