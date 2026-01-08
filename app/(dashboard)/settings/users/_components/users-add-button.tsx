'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { UserSheet } from '../users-sheet'
import type { UserAssignments } from '@/lib/settings/users/state/use-users-table-state'
import { cn } from '@/lib/utils'

type UsersAddButtonProps = {
  currentUserId: string
  assignments: UserAssignments
  className?: string
}

export function UsersAddButton({
  currentUserId,
  assignments,
  className,
}: UsersAddButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleComplete = () => {
    setOpen(false)
    router.refresh()
  }

  return (
    <div className={cn(className)}>
      <Button
        size='sm'
        type='button'
        onClick={() => setOpen(true)}
        className='gap-2'
      >
        <UserPlus className='h-4 w-4' />
        Add user
      </Button>
      <UserSheet
        open={open}
        onOpenChange={setOpen}
        onComplete={handleComplete}
        user={null}
        currentUserId={currentUserId}
        assignments={assignments}
      />
    </div>
  )
}
