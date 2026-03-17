'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ClientOption } from '@/lib/queries/contacts'

import { ContactsSheet } from './contacts-sheet'

type ContactsAddButtonProps = {
  allClients?: ClientOption[]
}

export function ContactsAddButton({ allClients = [] }: ContactsAddButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setSheetOpen(true)} size='sm'>
        <Plus className='h-4 w-4' />
        Add contact
      </Button>
      <ContactsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={() => setSheetOpen(false)}
        allClients={allClients}
      />
    </>
  )
}
