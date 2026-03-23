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
  linkedClientCount?: number
  isPending: boolean
  onConfirm: () => void
}

export function PromoteToUserDialog({
  open,
  onOpenChange,
  contactName,
  contactEmail,
  linkedClientCount = 0,
  isPending,
  onConfirm,
}: PromoteToUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Create Portal Account</DialogTitle>
          <DialogDescription>
            This will create a portal account for {contactName} (<span className='font-bold'>{contactEmail}</span>)
            {linkedClientCount > 0 ? (
              <> and grant them access to {linkedClientCount} linked client{linkedClientCount === 1 ? '' : 's'}.<br /><br />They&apos;ll receive an email with a temporary password.</>
            ) : (
              <>.<br /><br />They&apos;ll receive an email with a temporary password. No clients are currently linked — they won&apos;t see any projects until you link them to a client.</>
            )}
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
            {isPending ? 'Creating...' : 'Create & Notify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
