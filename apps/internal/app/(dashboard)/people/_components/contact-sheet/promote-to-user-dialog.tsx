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
import { Label } from '@pts/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { USER_ROLES } from '@/lib/settings/users/user-validation'

type Role = (typeof USER_ROLES)[number]

type PromoteToUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactName: string
  contactEmail: string
  isPending: boolean
  onConfirm: () => void
  /** With these, the dialog offers the role (the person sheet). */
  role?: Role
  onRoleChange?: (role: Role) => void
}

/** "Create sign-in": gives a person a sign-in and emails them a link. */
export function PromoteToUserDialog({
  open,
  onOpenChange,
  contactName,
  contactEmail,
  isPending,
  onConfirm,
  role = 'CLIENT',
  onRoleChange,
}: PromoteToUserDialogProps) {
  const isClient = role === 'CLIENT'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Create sign-in</DialogTitle>
          <DialogDescription>
            {isClient ? (
              <>
                {contactName} (<span className='font-bold'>{contactEmail}</span>)
                gets a client portal sign-in and an email with a one-time
                sign-in link. Which clients they see is set on each company
                (People &gt; Portal).
              </>
            ) : (
              <>
                {contactName} (<span className='font-bold'>{contactEmail}</span>)
                gets a {ROLE_LABELS[role]} sign-in to this portal and an email
                invite, and joins Place To Stand.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {onRoleChange ? (
          <div className='grid gap-2'>
            <Label htmlFor='create-sign-in-role'>Role</Label>
            <Select
              value={role}
              onValueChange={value => onRoleChange(value as Role)}
              disabled={isPending}
            >
              <SelectTrigger id='create-sign-in-role'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map(option => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
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
            {isPending ? 'Creating…' : 'Create & email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
