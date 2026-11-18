'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { updateProfile } from '@/app/(dashboard)/_actions/update-profile'
import { useToast } from '@/components/ui/use-toast'
import type { AppUser } from '@/lib/auth/session'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  announceKeptOpenSave,
  type SheetSaveMode,
} from '@/lib/sheets/save-mode'

export const accountProfileSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(120, 'Full name must be 120 characters or fewer'),
  email: z
    .email('Please enter a valid email address')
    .max(255, 'Email must be 255 characters or fewer')
    .optional()
    .or(z.literal('')),
  password: z
    .string()
    .optional()
    .refine(value => !value || value.trim().length >= 8, {
      message: 'Password must be at least 8 characters.',
    }),
  avatarPath: z.string().trim().min(1).max(255).optional().nullable(),
  avatarRemoved: z.boolean().optional(),
})

export type AccountProfileValues = z.infer<typeof accountProfileSchema>

const baseline = (user: AppUser): AccountProfileValues => ({
  fullName: user.full_name ?? '',
  email: '',
  password: '',
  avatarPath: user.avatar_url ?? null,
  avatarRemoved: false,
})

/**
 * The Account sheet's Profile form: photo, name, sign-in email and password,
 * saved in one `updateProfile` call by the sheet's footer. Everything else in
 * the sheet (integrations, preferences) acts on its own click.
 */
export function useAccountProfile({
  user,
  open,
  onClose,
}: {
  user: AppUser
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  // Remounts the photo field, dropping a staged upload, each time it opens.
  const [avatarFieldKey, setAvatarFieldKey] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setAvatarFieldKey(key => key + 1)
  }
  // Save waits for an upload in flight: saving mid-upload would keep the old
  // photo and orphan the new one.
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)

  const form = useForm<AccountProfileValues>({
    resolver: zodResolver(accountProfileSchema),
    defaultValues: baseline(user),
  })

  const reset = useCallback(() => form.reset(baseline(user)), [form, user])

  // Fresh each time it opens, from the user the server last rendered.
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const requestClose = useCallback(() => {
    if (isPending) return
    requestConfirmation(() => {
      reset()
      onClose()
    })
  }, [isPending, onClose, requestConfirmation, reset])

  const save = useCallback(
    (values: AccountProfileValues, mode: SheetSaveMode) => {
      startTransition(async () => {
        const newEmail = values.email?.trim() || undefined
        const result = await updateProfile({
          fullName: values.fullName.trim(),
          email: newEmail,
          password: values.password?.trim() || undefined,
          avatarPath: values.avatarPath?.trim() || undefined,
          avatarRemoved: Boolean(values.avatarRemoved),
        })

        if (result.error) {
          toast({
            variant: 'destructive',
            title: 'Unable to save profile',
            description: result.error,
          })
          return
        }

        toast(
          result.emailConfirmationSent
            ? {
                title: 'Confirmation email sent',
                description: `Check ${newEmail} for a link to finish changing your email.`,
              }
            : { title: 'Profile saved' }
        )

        if (mode === 'close') {
          reset()
          onClose()
        } else {
          // What was saved is the new baseline; email and password clear.
          form.reset({
            ...values,
            fullName: values.fullName.trim(),
            email: '',
            password: '',
            avatarRemoved: false,
          })
          announceKeptOpenSave()
        }
        router.refresh()
      })
    },
    [form, onClose, reset, router, toast]
  )

  const saveDisabledReason = isPending
    ? null
    : isAvatarUploading
      ? 'Waiting for the photo upload to finish.'
      : null

  return {
    form,
    isPending,
    saveLabel: isPending ? 'Saving...' : 'Save changes',
    avatarFieldKey,
    setIsAvatarUploading,
    canSave: !isPending && !isAvatarUploading,
    saveDisabledReason,
    save,
    requestClose,
    unsavedChangesDialog,
  }
}
