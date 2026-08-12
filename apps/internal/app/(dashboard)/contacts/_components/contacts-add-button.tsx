'use client'

import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'

/**
 * Opens the create sheet through `?contact=new` — the contacts tabs render
 * the sheet instance themselves, and every other route gets it from the
 * global SheetHost, so the button never mounts one of its own.
 */
export function ContactsAddButton() {
  const { openCreate } = useSheetParamSelection('contact')

  return (
    <Button onClick={openCreate} size='sm'>
      <Plus className='h-4 w-4' />
      Add contact
    </Button>
  )
}
