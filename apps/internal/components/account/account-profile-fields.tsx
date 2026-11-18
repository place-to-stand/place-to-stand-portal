'use client'

import { useWatch, type UseFormReturn } from 'react-hook-form'

import { Input } from '@pts/ui/input'

import { AvatarUploadField } from '@/components/forms/avatar-upload-field'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { AppUser } from '@/lib/auth/session'
import { PENDING_REASON } from '@/lib/forms/form-controls'
import { getInitials } from '@/lib/users/initials'

import type { AccountProfileValues } from './use-account-profile'

type Props = {
  form: UseFormReturn<AccountProfileValues>
  user: AppUser
  isPending: boolean
  avatarFieldKey: number
  onUploadingChange: (uploading: boolean) => void
}

/** Photo, name, sign-in email and password: the Account sheet's Profile. */
export function AccountProfileFields({
  form,
  user,
  isPending,
  avatarFieldKey,
  onUploadingChange,
}: Props) {
  const fullName = useWatch({ control: form.control, name: 'fullName' })
  const reason = isPending ? PENDING_REASON : null
  const displayName = fullName?.trim() || user.full_name || user.email

  return (
    <>
      <FormField
        control={form.control}
        name='avatarPath'
        render={({ field }) => (
          <FormItem>
            <FormLabel optional>Photo</FormLabel>
            <FormControl>
              <AvatarUploadField
                key={avatarFieldKey}
                value={field.value ?? null}
                onChange={next =>
                  form.setValue('avatarPath', next, { shouldDirty: true })
                }
                onRemovalChange={removed =>
                  form.setValue('avatarRemoved', removed, { shouldDirty: true })
                }
                onUploadingChange={onUploadingChange}
                initials={getInitials(displayName)}
                displayName={displayName}
                disabled={isPending}
                targetUserId={user.id}
                existingUserId={user.id}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='fullName'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full name</FormLabel>
            <FormControl>
              <DisabledFieldTooltip disabled={isPending} reason={reason}>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder='Ada Lovelace'
                  autoComplete='name'
                  disabled={isPending}
                />
              </DisabledFieldTooltip>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel optional>New email</FormLabel>
              <FormControl>
                <DisabledFieldTooltip disabled={isPending} reason={reason}>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    type='email'
                    placeholder={user.email}
                    autoComplete='email'
                    disabled={isPending}
                  />
                </DisabledFieldTooltip>
              </FormControl>
              <FormDescription>
                We email the new address a link to confirm it.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel optional>New password</FormLabel>
              <FormControl>
                <DisabledFieldTooltip disabled={isPending} reason={reason}>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    type='password'
                    autoComplete='new-password'
                    disabled={isPending}
                  />
                </DisabledFieldTooltip>
              </FormControl>
              <FormDescription>
                Leave blank to keep your current one.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  )
}
