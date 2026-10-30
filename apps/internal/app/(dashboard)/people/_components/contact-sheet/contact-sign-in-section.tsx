'use client'

import { useState, useTransition } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { formatRelativeTime } from '@pts/ui/dates'
import { Input } from '@pts/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Skeleton } from '@pts/ui/skeleton'
import { Switch } from '@pts/ui/switch'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/components/ui/use-toast'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import {
  restoreUser,
  softDeleteUser,
} from '@/app/(dashboard)/settings/users/actions'
import { ROLE_LABELS } from '@/lib/auth/roles'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'
import type { ContactFormData } from '@/lib/settings/contacts/use-contact-sheet-state'
import { USER_ROLES } from '@/lib/settings/users/user-validation'

type ContactSignInFieldsProps = {
  form: UseFormReturn<ContactFormData>
  /** undefined = loading, null = could not load. */
  account: PortalAccountSummary | null | undefined
  personName: string
  isPending: boolean
  pendingReason: string
  /** Refetch after archive / restore. */
  onAccountChanged: () => void
}

/**
 * A person's sign-in (admins only), laid out like the old Edit user sheet:
 * Role | Access, then Temporary password. These save with the sheet's Save.
 * Archive / restore sign-in is a confirmed action, like the footer archive.
 */
export function ContactSignInFields({
  form,
  account,
  personName,
  isPending,
  pendingReason,
  onAccountChanged,
}: ContactSignInFieldsProps) {
  const { toast } = useToast()
  const { userId: viewerId } = useViewerAccess()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [isActing, startAction] = useTransition()

  if (account === undefined) {
    return (
      <div className='grid gap-4 sm:grid-cols-2'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-9 w-full' />
      </div>
    )
  }
  if (account === null) {
    return (
      <p className='text-muted-foreground text-sm'>
        This sign-in could not be loaded.
      </p>
    )
  }

  const isSelf = viewerId === account.id
  const isArchived = Boolean(account.deletedAt)
  const busy = isPending || isActing
  const lockedReason = busy
    ? pendingReason
    : isArchived
      ? 'Restore the sign-in to change it.'
      : null
  const selfReason = isSelf ? 'You can’t change your own role or access.' : null
  const name = personName || account.email

  const runArchive = (archive: boolean) =>
    startAction(async () => {
      const result = archive
        ? await softDeleteUser({ id: account.id })
        : await restoreUser({ id: account.id })
      if (result.error) {
        toast({
          title: archive ? 'Unable to archive sign-in' : 'Unable to restore sign-in',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: archive ? 'Sign-in archived' : 'Sign-in restored',
        description: name,
      })
      onAccountChanged()
    })

  return (
    <>
      <dl className='grid grid-cols-1 gap-4 text-sm sm:grid-cols-2'>
        <div className='space-y-1'>
          <dt className='text-muted-foreground text-xs'>Sign-in email</dt>
          <dd className='truncate'>{account.email}</dd>
        </div>
        <div className='space-y-1'>
          <dt className='text-muted-foreground text-xs'>Last sign-in</dt>
          <dd>
            {isArchived
              ? 'Archived'
              : (formatRelativeTime(account.lastSignInAt) ?? 'Never')}
          </dd>
        </div>
      </dl>

      <div className='grid grid-cols-1 items-start gap-4 sm:grid-cols-2'>
        <FormField
          control={form.control}
          name='signIn.role'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={Boolean(lockedReason ?? selfReason)}
                  reason={lockedReason ?? selfReason}
                >
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? account.role}
                    disabled={Boolean(lockedReason ?? selfReason)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select a role' />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map(role => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='signIn.accessEnabled'
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor='person-sheet-access-toggle'>Access</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={Boolean(lockedReason ?? selfReason)}
                  reason={lockedReason ?? selfReason}
                  className='w-auto'
                >
                  <div className='flex h-9 items-center gap-2'>
                    <Switch
                      id='person-sheet-access-toggle'
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={Boolean(lockedReason ?? selfReason)}
                      aria-label={
                        (field.value ?? true)
                          ? `Disable sign-in for ${name}`
                          : `Enable sign-in for ${name}`
                      }
                    />
                    <span className='text-sm'>
                      {(field.value ?? true) ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name='signIn.password'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Temporary password</FormLabel>
            <FormControl>
              <DisabledFieldTooltip
                disabled={Boolean(lockedReason)}
                reason={lockedReason}
              >
                <Input
                  {...field}
                  type='password'
                  autoComplete='new-password'
                  value={field.value ?? ''}
                  placeholder='••••••••'
                  disabled={Boolean(lockedReason)}
                />
              </DisabledFieldTooltip>
            </FormControl>
            <FormDescription>
              Setting one forces a reset on next sign-in. 8+ characters.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div>
        <DisabledFieldTooltip
          disabled={busy || isSelf}
          reason={busy ? pendingReason : selfReason}
          className='w-auto'
        >
          <Button
            type='button'
            variant='outline'
            size='sm'
            className={
              isArchived ? undefined : 'text-muted-foreground hover:text-destructive'
            }
            disabled={busy || isSelf}
            onClick={() =>
              isArchived ? runArchive(false) : setArchiveOpen(true)
            }
          >
            {isArchived ? 'Restore sign-in' : 'Archive sign-in'}
          </Button>
        </DisabledFieldTooltip>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title='Archive sign-in?'
        description={`${name} can no longer sign in. The person stays, and the sign-in can be restored.`}
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={busy}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => {
          setArchiveOpen(false)
          runArchive(true)
        }}
      />
    </>
  )
}
