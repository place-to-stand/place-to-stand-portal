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
  promoteContactToUser,
  getContactSheetData,
} from '@/app/(dashboard)/contacts/actions'
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
    })
  ),
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
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false)
  // An edit's Companies list arrives after the sheet opens. Until it has,
  // a save leaves their companies alone rather than sending an empty list.
  const [companiesLoaded, setCompaniesLoaded] = useState(false)

  const { toast } = useToast()
  const isEditing = Boolean(contact?.id)

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
    if (!contactId) {
      return
    }

    let cancelled = false
    getContactSheetData(contactId)
      .then(data => {
        if (cancelled) return
        setCompaniesLoaded(true)
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
          })),
        })
      })
      .catch(err => {
        console.error('Failed to fetch contact sheet data:', err)
      })

    return () => {
      cancelled = true
    }
  }, [open, contact, form, initialName, initialCompanyId])

  const contactDisplayName = contact?.name || contact?.email || 'this contact'
  const sheetTitle = isEditing ? 'Edit contact' : 'Create contact'
  const sheetDescription = isEditing
    ? `Update the details for ${contactDisplayName}.`
    : 'Add a new contact to your organization.'

  // Unsaved changes warning
  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: form.formState.isDirty })

  const submitDisabled = isPending
  const submitDisabledReason = isPending ? PENDING_REASON : null

  const deleteDisabled = isPending || !isEditing
  const deleteDisabledReason = isPending
    ? PENDING_REASON
    : !isEditing
      ? 'Cannot archive a new contact.'
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
                // Only a company with a client has portal access to give.
                portalAccess: entry.clientId ? entry.portalAccess : undefined,
              }))
            : undefined,
        })

        if (result.error) {
          setFeedback(result.error)
          toast({
            title: isEditing
              ? 'Unable to update contact'
              : 'Unable to create contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: isEditing ? 'Contact updated' : 'Contact created',
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
    [contact?.id, companiesLoaded, isEditing, toast, onComplete, onCreated]
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

  // The portal user this contact was promoted to (`contacts.user_id`).
  const portalUserId = contact?.userId ?? null
  const hasPortalAccess = Boolean(portalUserId)

  // Portal access signs in by email, so a contact without one can't get it.
  const hasEmail = Boolean(contact?.email)
  const promoteDisabled =
    isPending || !isEditing || hasPortalAccess || !hasEmail
  const promoteDisabledReason = isPending
    ? PENDING_REASON
    : !isEditing
      ? 'Save the contact first.'
      : hasPortalAccess
        ? 'This contact already has portal access.'
        : !hasEmail
          ? 'Add an email and save before giving portal access.'
          : null

  const handleRequestPromote = useCallback(() => {
    if (promoteDisabled) return
    setIsPromoteDialogOpen(true)
  }, [promoteDisabled])

  const handleConfirmPromote = useCallback(() => {
    const contactId = contact?.id
    if (!contactId || isPending) {
      setIsPromoteDialogOpen(false)
      return
    }

    setIsPromoteDialogOpen(false)
    startTransition(async () => {
      const result = await promoteContactToUser(contactId)

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to create portal account',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Portal account created',
        description: `A portal invite has been sent to ${contact?.name || contact?.email || 'the contact'}.`,
      })
      onComplete()
    })
  }, [contact, isPending, toast, onComplete])

  const handleConfirmDelete = useCallback(() => {
    const contactId = contact?.id
    const displayName = contact?.name || contact?.email || 'this contact'

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
          title: 'Unable to archive contact',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Contact archived',
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
    pendingReason: PENDING_REASON,
    sheetTitle,
    sheetDescription,
    contactDisplayName,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    isDeleteDialogOpen,
    isPromoteDialogOpen,
    setIsPromoteDialogOpen,
    portalUserId,
    promoteDisabled,
    promoteDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRequestPromote,
    handleConfirmPromote,
  }
}
