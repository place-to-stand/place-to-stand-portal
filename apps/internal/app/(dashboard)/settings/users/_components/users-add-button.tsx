'use client'

import { UserPlus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import { cn } from '@/lib/utils'

type UsersAddButtonProps = {
  className?: string
}

export function UsersAddButton({ className }: UsersAddButtonProps) {
  // Opens `?user=new`; the table's single sheet instance renders it, so this
  // button doesn't own a duplicate copy.
  const { openCreate } = useSheetParamSelection('user')

  return (
    <div className={cn(className)}>
      <Button size='sm' type='button' onClick={openCreate} className='gap-2'>
        <UserPlus className='h-4 w-4' />
        Add user
      </Button>
    </div>
  )
}
