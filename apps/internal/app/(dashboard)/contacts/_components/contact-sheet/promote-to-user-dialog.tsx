'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type PromoteToUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactName: string
  contactEmail: string
  isPending: boolean
  onConfirm: () => void
}

export function PromoteToUserDialog({
  open,
  onOpenChange,
  contactName,
  contactEmail,
  isPending,
  onConfirm,
}: PromoteToUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Create Portal Account</DialogTitle>
          <DialogDescription>
            This will create a portal account for {contactName} ({contactEmail})
            and send them an invite with a temporary password.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='mt-4'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
