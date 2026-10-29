'use client'

import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

export function CompaniesAddButton() {
  const { openNew } = useSheetParams()

  return (
    <Button onClick={() => openNew('company')} size='sm'>
      <Plus className='h-4 w-4' />
      Add company
    </Button>
  )
}
