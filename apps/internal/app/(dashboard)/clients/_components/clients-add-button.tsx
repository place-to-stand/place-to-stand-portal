'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ClientSheet } from './clients-sheet'

type ClientsAddButtonProps = {
  className?: string
}

export function ClientsAddButton({
  className,
}: ClientsAddButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleComplete = () => {
    setOpen(false)
    router.refresh()
  }

  return (
    <div className={cn(className)}>
      <Button size='sm' type='button' onClick={() => setOpen(true)} className='gap-2'>
        <Plus className='h-4 w-4' />
        Add client
      </Button>
      <ClientSheet
        open={open}
        onOpenChange={setOpen}
        onComplete={handleComplete}
        client={null}
      />
    </div>
  )
}
