'use client'

import { Button } from '@pts/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'

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
          <DialogTitle>Create portal user</DialogTitle>
          <DialogDescription>
            This creates a client portal user for {contactName} (
            <span className='font-bold'>{contactEmail}</span>) and emails them a
            one-time sign-in link (no password needed).
            <br />
            <br />
            Which clients they can see is set on each client, in Edit client
            &gt; Portal access.
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
          <Button type='button' onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Creating...' : 'Create & notify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
