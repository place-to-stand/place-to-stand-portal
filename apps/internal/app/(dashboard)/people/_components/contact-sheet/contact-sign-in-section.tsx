'use client'

import { useTransition } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { Button } from '@pts/ui/button'
import { formatRelativeTime } from '@pts/ui/dates'
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
import { sendPersonPasswordResetAction } from '@/app/(dashboard)/people/actions'
import { ROLE_LABELS } from '@/lib/auth/roles'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'
import type { ContactFormData } from '@/lib/settings/contacts/use-contact-sheet-state'
import { USER_ROLES } from '@/lib/settings/users/user-validation'

type ContactSignInFieldsProps = {
  form: UseFormReturn<ContactFormData>
  /** Their sign-in; undefined while loading, null when they have none. */
  account: PortalAccountSummary | null | undefined
  hasSignIn: boolean
  contactId: string | null
  personName: string
  /** Their saved email: the one they sign in with. */
  personEmail: string
  isPending: boolean
  pendingReason: string
}

/** What turning sign-in on (or saving a change) will do, in one line. */
function outcomeLine({
  hasSignIn,
  enabled,
  role,
  email,
}: {
  hasSignIn: boolean
  enabled: boolean
  role: (typeof USER_ROLES)[number]
  email: string
}) {
  if (!hasSignIn) {
    if (!enabled) return null
    return role === 'CLIENT'
      ? `Saving creates a client portal sign-in for ${email} and emails them a link.`
      : `Saving creates a ${ROLE_LABELS[role]} sign-in to this portal for ${email} and emails them an invite.`
  }
  return enabled
    ? `They sign in with ${email}.`
    : 'Turned off: they can’t sign in.'
}

/**
 * A person's sign-in (admins only). Their email is the login. One switch says
 * whether they can sign in, and the role says where and what they see.
 * Changes save with the sheet's Save.
 */
export function ContactSignInFields({
  form,
  account,
  hasSignIn,
  contactId,
  personName,
  personEmail,
  isPending,
  pendingReason,
}: ContactSignInFieldsProps) {
  const { toast } = useToast()
  const { userId: viewerId } = useViewerAccess()
  const [isSending, startSending] = useTransition()
  const enabled = useWatch({ control: form.control, name: 'signIn.enabled' })
  const role = useWatch({ control: form.control, name: 'signIn.role' })

  if (hasSignIn && account === undefined) {
    return (
      <div className='grid gap-4 sm:grid-cols-2'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-9 w-full' />
      </div>
    )
  }

  const isSelf = Boolean(account && viewerId === account.id)
  const noEmail = !personEmail
  const lockedReason = isPending
    ? pendingReason
    : isSelf
      ? 'You can’t change your own sign-in.'
      : !hasSignIn && noEmail
        ? 'They need an email to sign in.'
        : null
  const line = outcomeLine({
    hasSignIn,
    enabled: Boolean(enabled),
    role: role ?? 'CLIENT',
    email: personEmail,
  })

  const sendReset = () =>
    startSending(async () => {
      if (!contactId) return
      const result = await sendPersonPasswordResetAction(contactId)
      toast(
        result.error
          ? {
              title: 'Reset email not sent',
              description: result.error,
              variant: 'destructive',
            }
          : {
              title: 'Password reset sent',
              description: `${personName || personEmail} gets a link to set a new password.`,
            }
      )
    })

  return (
    <>
      <div className='grid grid-cols-1 items-start gap-4 sm:grid-cols-2'>
        <FormField
          control={form.control}
          name='signIn.enabled'
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor='person-sheet-can-sign-in'>
                Can sign in
              </FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={Boolean(lockedReason)}
                  reason={lockedReason}
                  className='w-auto'
                >
                  <div className='flex h-9 items-center gap-2'>
                    <Switch
                      id='person-sheet-can-sign-in'
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      disabled={Boolean(lockedReason)}
                    />
                    <span className='text-sm'>{field.value ? 'On' : 'Off'}</span>
                  </div>
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='signIn.role'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={Boolean(lockedReason)}
                  reason={lockedReason}
                >
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? 'CLIENT'}
                    disabled={Boolean(lockedReason)}
                  >
                    <SelectTrigger>
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
                </DisabledFieldTooltip>
              </FormControl>
              <FormDescription>
                {(field.value ?? 'CLIENT') === 'CLIENT'
                  ? 'The client portal, for the companies they have portal access to.'
                  : field.value === 'SALES'
                    ? 'This portal: leads, people and companies.'
                    : 'This portal, everything.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {line ? <p className='text-muted-foreground text-sm'>{line}</p> : null}

      {hasSignIn && account ? (
        <div className='flex flex-wrap items-center justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>
            Last sign-in: {formatRelativeTime(account.lastSignInAt) ?? 'never'}
          </span>
          <DisabledFieldTooltip
            disabled={isSending || isPending || isSelf}
            reason={isSelf ? 'Use Forgot password on the sign-in page.' : null}
            className='w-auto'
          >
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={isSending || isPending || isSelf}
              onClick={sendReset}
            >
              {isSending ? 'Sending…' : 'Send password reset'}
            </Button>
          </DisabledFieldTooltip>
        </div>
      ) : null}
    </>
  )
}
