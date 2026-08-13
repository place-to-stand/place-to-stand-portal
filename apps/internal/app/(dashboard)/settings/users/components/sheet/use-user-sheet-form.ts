"use client"

import { useCallback, useMemo, useState } from "react"
import { useForm, useWatch, type UseFormReturn } from "react-hook-form"

import { deriveInitials } from "./derive-initials"
import {
  createUserFormResolver,
  editUserFormResolver,
  type UserFormValues,
} from "./form-schema"
import type { UserRow } from "./types"

type UseUserSheetFormArgs = {
  user: UserRow | null
  isEditing: boolean
}

export type UseUserSheetFormReturn = {
  form: UseFormReturn<UserFormValues>
  resetFormState: () => void
  avatarFieldKey: number
  avatarInitials: string
  avatarDisplayName: string | null
}

export function useUserSheetForm({
  user,
  isEditing,
}: UseUserSheetFormArgs): UseUserSheetFormReturn {
  const resolver = useMemo(
    () => (isEditing ? editUserFormResolver : createUserFormResolver),
    [isEditing]
  )

  const form = useForm<UserFormValues>({
    resolver,
    defaultValues: {
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "CLIENT",
      password: "",
      avatarPath: user?.avatar_url ?? null,
      avatarRemoved: false,
      accessEnabled: !user?.disabled_at,
    },
  })

  const [avatarFieldKey, setAvatarFieldKey] = useState(0)

  const resetFormState = useCallback(() => {
    form.reset({
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "CLIENT",
      password: "",
      avatarPath: user?.avatar_url ?? null,
      avatarRemoved: false,
      accessEnabled: !user?.disabled_at,
    })
    form.clearErrors()
    setAvatarFieldKey((key) => key + 1)
  }, [form, user])

  const watchedFullName = useWatch({ control: form.control, name: "fullName" })
  const watchedEmail = useWatch({ control: form.control, name: "email" })

  const avatarInitials = deriveInitials(
    watchedFullName || user?.full_name,
    watchedEmail || user?.email
  )
  const avatarDisplayName = watchedFullName || user?.full_name || null

  return {
    form,
    resetFormState,
    avatarFieldKey,
    avatarInitials,
    avatarDisplayName,
  }
}

