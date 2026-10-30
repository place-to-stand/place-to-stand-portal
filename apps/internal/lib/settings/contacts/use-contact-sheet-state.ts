'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useToast } from '@/components/ui/use-toast'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  saveContact,
  softDeleteContact,
  getContactSheetData,
  getContactPortalAccount,
  savePersonAvatar,
  savePersonSignInAction,
} from '@/app/(dashboard)/people/actions'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'
import { USER_ROLES } from '@/lib/settings/users/user-validation'
import type { ContactsTableContact } from '@/lib/settings/contacts/use-contacts-table-state'
import { PENDING_REASON } from '@/lib/forms/form-controls'

/** The record handed to `onCreated` (and to a host picker underneath). */
export type CreatedContact = ContactSheetInput

const contactFormSchema = z.object({
  email: z.union([
    z.string().trim().email({ message: 'Enter a valid email' }),
    z.literal(''),
  ]),
  name: z.string().min(1, 'Name is required').max(160),
  phone: z.string().max(40).optional(),
  linkedinUrl: z.string().max(255).optional(),
  /** Every company they belong to, staged until Save. */
  companies: z.array(
    z.object({
      companyId: z.string().uuid(),
      companyName: z.string(),
      title: z.string().max(160),
      /** Set on the company sheet; shown read-only here. */
      isPrimary: z.boolean(),
      portalAccess: z.boolean(),
      clientId: z.string().nullable(),
      clientName: z.string().nullable(),
      /** The company or its client is archived: shown muted, kept on save. */
      archived: z.boolean().optional(),
    })
  ),
  /** Their photo: a staged upload's path, saved with the sheet. */
  avatarPath: z.string().trim().max(255).nullable().optional(),
  avatarRemoved: z.boolean().optional(),
  /** Their sign-in (admins only): can they sign in, and as what. */
  signIn: z
    .object({
      enabled: z.boolean(),
      role: z.enum(USER_ROLES),
    })
    .optional(),
})

export type ContactCompanyEntry = z.infer<
  typeof contactFormSchema
>['companies'][number]

export type ContactFormData = z.infer<typeof contactFormSchema>

/** Minimal contact data needed for the sheet form */
export type ContactSheetInput = {
  id: string
  email: string | null
  name: string
  phone: string | null
  userId: string | null
  // Sales profile. Optional so older callers (pickers handing back a
  // just-created contact) still type-check; the sheet treats missing as empty.
  jobTitle?: string | null
  linkedinUrl?: string | null
  companyId?: string | null
  companyName?: string | null
}

export type UseContactSheetStateOptions = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  /** Fires once with the new contact after a successful create (not on edit). */
  onCreated?: (contact: CreatedContact) => void
  /** Name prefill for the create sheet (create-from-picker). */
  initialName?: string
  /** Company prefill for the create sheet (only the id; the picker names it). */
  initialCompanyId?: string
  contact?: ContactsTableContact | ContactSheetInput | null
}

export function useContactSheetState({
  open,
  onOpenChange,
  onComplete,
  onCreated,
  initialName,
  initialCompanyId,
  contact,
}: UseContactSheetStateOptions) {
  const [isTransitionPending, startTransition] = useTransition()
  const isPending = isTransitionPending
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  // An edit's Companies list arrives after the sheet opens. Until it has,
  // a save leaves their companies alone rather than sending an empty list.
  const [companiesLoaded, setCompaniesLoaded] = useState(false)
  const [companiesLoadFailed, setCompaniesLoadFailed] = useState(false)

  const { toast } = useToast()
  const isEditing = Boolean(contact?.id)
  // Sign-ins are admin-only. undefined = loading (or none to load).
  const { isAdmin } = useViewerAccess()
  const signInUserId = isAdmin ? (contact?.userId ?? null) : null
  const [signInAccount, setSignInAccount] = useState<
    PortalAccountSummary | null | undefined
  >(undefined)
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: '',
      name: '',
      phone: '',
      linkedinUrl: '',
      companies: [],
    },
  })

  // Initialize the form and load the contact's clients when the sheet opens
  useEffect(() => {
    if (!open) {
      return
    }

    const contactId = contact?.id

    // Reset form - intentional setState during effect to sync UI with prop changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedback(null)
    form.reset({
      avatarPath: null,
      avatarRemoved: false,
      // No sign-in yet: off, and Client if they turn it on.
      signIn: isAdmin && contact ? { enabled: false, role: 'CLIENT' } : undefined,
      email: contact?.email ?? '',
      name: contact?.name ?? initialName ?? '',
      phone: contact?.phone ?? '',
      linkedinUrl: contact?.linkedinUrl ?? '',
      // A create from a company (e.g. the lead sheet) starts there; the
      // picker names it.
      companies:
        !contact && initialCompanyId
          ? [
              {
                companyId: initialCompanyId,
                companyName: '',
                title: '',
                isPrimary: false,
                portalAccess: false,
                clientId: null,
                clientName: null,
              },
            ]
          : [],
    })

    setCompaniesLoaded(!contactId)
    setCompaniesLoadFailed(false)
    if (!contactId) {
      return
    }

    let cancelled = false
    getContactSheetData(contactId)
      .then(data => {
        if (cancelled) return
        setCompaniesLoaded(true)
        form.resetField('avatarPath', { defaultValue: data.avatarUrl })
        // Loaded after the reset: becomes the saved state, not an edit.
        form.resetField('companies', {
          defaultValue: data.memberships.map(membership => ({
            companyId: membership.companyId,
            companyName: membership.companyName,
            title: membership.title ?? '',
            isPrimary: membership.isPrimary,
            portalAccess: membership.portalAccess,
            clientId: membership.clientId,
            clientName: membership.clientName,
            archived: membership.archived,
          })),
        })
      })
      .catch(err => {
        console.error('Failed to fetch contact sheet data:', err)
        if (!cancelled) setCompaniesLoadFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [open, contact, form, initialName, initialCompanyId, isAdmin])

  // Their sign-in, loaded after the reset like the companies: it becomes
  // the saved state of the Sign-in fields, not an edit.
  const loadSignIn = useCallback(async () => {
    if (!signInUserId) return
    try {
      const account = await getContactPortalAccount(signInUserId)
      setSignInAccount(account)
      if (account) {
        form.resetField('signIn', {
          defaultValue: {
            enabled: !account.disabledAt && !account.deletedAt,
            role: account.role,
          },
        })
      }
    } catch (error) {
      console.error('Failed to load sign-in:', error)
      setSignInAccount(null)
    }
  }, [form, signInUserId])

  useEffect(() => {
    if (!open || !signInUserId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignInAccount(undefined)
    void loadSignIn()
  }, [open, signInUserId, loadSignIn])

  const contactDisplayName = contact?.name || contact?.email || 'this person'
  const sheetTitle = isEditing ? 'Edit person' : 'Create person'
  const sheetDescription = isEditing
    ? `Update the details for ${contactDisplayName}.`
    : 'Add a new person to your organization.'

  // Unsaved changes warning
  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const submitDisabled = isPending || isAvatarUploading
  const submitDisabledReason = isPending
    ? PENDING_REASON
    : isAvatarUploading
      ? 'Wait for the photo to finish uploading.'
      : null

  const deleteDisabled = isPending || !isEditing
  const deleteDisabledReason = isPending
    ? PENDING_REASON
    : !isEditing
      ? 'Cannot archive a new person.'
      : null

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isPending) {
        return
      }
      if (!nextOpen) {
        requestConfirmation(() => onOpenChange(false))
      } else {
        onOpenChange(true)
      }
    },
    [isPending, onOpenChange, requestConfirmation]
  )

  const handleFormSubmit = useCallback(
    (data: ContactFormData) => {
      setFeedback(null)
      startTransition(async () => {
        // Save contact data
        const result = await saveContact({
          id: contact?.id || undefined,
          email: data.email,
          name: data.name,
          phone: data.phone || null,
          linkedinUrl: data.linkedinUrl?.trim() || null,
          companies: companiesLoaded
            ? data.companies.map(entry => ({
                companyId: entry.companyId,
                title: entry.title.trim() || null,
              }))
            : undefined,
        })

        if (result.error) {
          setFeedback(result.error)
          toast({
            title: isEditing
              ? 'Unable to update person'
              : 'Unable to create person',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        const savedId = contact?.id ?? result.id
        // Their photo, then their sign-in (admins), save with the sheet too.
        const dirty = form.formState.dirtyFields
        if (savedId && (dirty.avatarPath || dirty.avatarRemoved)) {
          const photo = await savePersonAvatar({
            contactId: savedId,
            avatarPath: data.avatarPath ?? null,
            avatarRemoved: Boolean(data.avatarRemoved),
          })
          if (photo.error) {
            setFeedback(photo.error)
            toast({
              title: 'Person saved, photo not saved',
              description: photo.error,
              variant: 'destructive',
            })
            return
          }
        }
        if (savedId && isAdmin && data.signIn && dirty.signIn) {
          const signIn = await savePersonSignInAction({
            contactId: savedId,
            enabled: data.signIn.enabled,
            role: data.signIn.role,
          })
          if (signIn.error) {
            setFeedback(signIn.error)
            toast({
              title: 'Person saved, sign-in not saved',
              description: signIn.error,
              variant: 'destructive',
            })
            return
          }
        }

        toast({
          title: isEditing ? 'Person updated' : 'Person created',
          description: isEditing
            ? `${data.name || data.email} has been updated.`
            : `${data.name || data.email} has been created.`,
        })

        // Call onCreated with the new contact ID if this was a create operation
        if (!isEditing && result.id && onCreated) {
          onCreated({
            id: result.id,
            email: data.email || null,
            name: data.name,
            phone: data.phone || null,
            // Just created, so never promoted yet.
            userId: null,
          })
        }

        onComplete()
      })
    },
    [
      contact?.id,
      companiesLoaded,
      form,
      isAdmin,
      isEditing,
      toast,
      onComplete,
      onCreated,
    ]
  )

  const handleRequestDelete = useCallback(() => {
    if (!isEditing || isPending) {
      return
    }
    setIsDeleteDialogOpen(true)
  }, [isEditing, isPending])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }
    setIsDeleteDialogOpen(false)
  }, [isPending])

  // Their sign-in, if they have one (`contacts.user_id`).
  const portalUserId = contact?.userId ?? null

  const handleConfirmDelete = useCallback(() => {
    const contactId = contact?.id
    const displayName = contact?.name || contact?.email || 'this person'

    if (!contactId || isPending) {
      setIsDeleteDialogOpen(false)
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      const result = await softDeleteContact({ id: contactId })

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to archive person',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Person archived',
        description: `${displayName} has been archived.`,
      })
      onComplete()
    })
  }, [contact, isPending, toast, onComplete])

  return {
    form,
    feedback,
    isPending,
    isEditing,
    companiesLoadFailed,
    pendingReason: PENDING_REASON,
    sheetTitle,
    sheetDescription,
    contactDisplayName,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    isDeleteDialogOpen,
    portalUserId,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    signInAccount,
    setIsAvatarUploading,
  }
}
