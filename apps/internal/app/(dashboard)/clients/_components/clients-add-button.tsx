'use client'

import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

type ClientsAddButtonProps = {
  className?: string
}

/**
 * Opens the create sheet through `?client=new` — the clients tabs render the
 * sheet instance themselves, and every other route gets it from the global
 * SheetHost, so the button never mounts one of its own.
 */
export function ClientsAddButton({ className }: ClientsAddButtonProps) {
  const { openCreate } = useSheetParamSelection('client')

  return (
    <div className={cn(className)}>
      <Button size='sm' type='button' onClick={openCreate} className='gap-2'>
        <Plus className='h-4 w-4' />
        Add client
      </Button>
    </div>
  )
}
