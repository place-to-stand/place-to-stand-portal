import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  saveClient,
  getClientSheetContactData,
  syncClientContacts,
} from '@/app/(dashboard)/clients/actions'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import { PENDING_REASON } from '../client-sheet-constants'
import {
  clientSheetFormSchema,
  type ClientSheetFormValues,
} from '../client-sheet-schema'

import type {
  BaseFormState,
  ClientContactOption,
  ClientSheetFormStateArgs,
  ReferralContactOption,
} from './types'

export function useClientSheetFormState({
  open,
  onOpenChange,
  onComplete,
  client,
  allContacts: allContactsProp,
  clientContacts: clientContactsProp,
  isEditing,
  isPending,
  startTransition,
  setFeedback,
  toast,
}: ClientSheetFormStateArgs): BaseFormState {
  // Contact state
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false)
  const [fetchedAllContacts, setFetchedAllContacts] = useState<ClientContactOption[]>([])
  const [selectedContacts, setSelectedContacts] = useState<ClientContactOption[]>([])
  const [initialContacts, setInitialContacts] = useState<ClientContactOption[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  // Referral state
  const [isReferralPickerOpen, setIsReferralPickerOpen] = useState(false)
  const [selectedReferral, setSelectedReferral] = useState<ReferralContactOption | null>(null)
  const [initialReferralId, setInitialReferralId] = useState<string | null>(null)

  const form = useForm<ClientSheetFormValues>({
    resolver: zodResolver(clientSheetFormSchema),
    defaultValues: {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      billingType: client?.billing_type ?? 'prepaid',
      state: client?.state ?? '',
      website: client?.website ?? '',
      notes: client?.notes ?? '',
    },
  })

  // Use provided allContacts or fetched ones
  const allContacts = allContactsProp ?? fetchedAllContacts

  // Compute available contacts (all contacts minus selected ones)
  const availableContacts = useMemo(() => {
    const selectedIds = new Set(selectedContacts.map(c => c.id))
    return allContacts.filter(c => !selectedIds.has(c.id))
  }, [allContacts, selectedContacts])

  // Check if contact links have changed
  const contactsDirty = useMemo(() => {
    const initialIds = new Set(initialContacts.map(c => c.id))
    const selectedIds = new Set(selectedContacts.map(c => c.id))

    if (initialIds.size !== selectedIds.size) return true
    for (const id of initialIds) {
      if (!selectedIds.has(id)) return true
    }
    return false
  }, [initialContacts, selectedContacts])

  // Compute available contacts for referral (excludes currently selected)
  const availableReferralContacts = useMemo<ReferralContactOption[]>(() => {
    return allContacts
      .filter(c => c.id !== selectedReferral?.id)
      .map(c => ({ id: c.id, name: c.name, email: c.email }))
  }, [allContacts, selectedReferral])

  // Check if referral has changed
  const referralDirty = useMemo(() => {
    const currentId = selectedReferral?.id ?? null
    return currentId !== initialReferralId
  }, [selectedReferral, initialReferralId])

  const contactsAddButtonDisabled = isPending || isLoadingContacts || availableContacts.length === 0
  const contactsAddButtonDisabledReason = contactsAddButtonDisabled
    ? isPending
      ? PENDING_REASON
      : isLoadingContacts
        ? 'Loading contacts...'
        : 'All contacts are already linked.'
    : null

  const referralPickerDisabled = isPending || isLoadingContacts
  const referralPickerDisabledReason = referralPickerDisabled
    ? isPending
      ? PENDING_REASON
      : 'Loading contacts...'
    : null

  const submitDisabled = isPending
  const submitDisabledReason = submitDisabled ? PENDING_REASON : null

  const hasUnsavedChanges = form.formState.isDirty || contactsDirty || referralDirty

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasUnsavedChanges })

  const resetFormState = useCallback(() => {
    const defaults = {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      billingType: client?.billing_type ?? 'prepaid',
      state: client?.state ?? '',
      website: client?.website ?? '',
      notes: client?.notes ?? '',
    }

    form.reset(defaults)
    setFeedback(null)

    // Reset contacts
    setIsContactPickerOpen(false)

    // Reset referral
    setIsReferralPickerOpen(false)
  }, [client, form, setFeedback])

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      resetFormState()
    })

    // Initialize contacts from props if provided
    // Intentional: Sync contact state with props when sheet opens
    /* eslint-disable react-hooks/set-state-in-effect */
    if (clientContactsProp) {
      setSelectedContacts(clientContactsProp)
      setInitialContacts(clientContactsProp)
    } else {
      setSelectedContacts([])
      setInitialContacts([])
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    // Fetch contact data if not provided via props
    const clientId = client?.id
    const clientReferredBy = client?.referred_by ?? null
    const shouldFetch = !allContactsProp || allContactsProp.length === 0

    // Initialize referral from client
    setInitialReferralId(clientReferredBy)

    if (shouldFetch) {
      setIsLoadingContacts(true)
      getClientSheetContactData(clientId)
        .then(data => {
          setFetchedAllContacts(data.allContacts)
          if (clientId && data.linkedContacts.length > 0) {
            setSelectedContacts(data.linkedContacts)
            setInitialContacts(data.linkedContacts)
          }
          // Set referral from fetched contacts if client has referred_by
          if (clientReferredBy) {
            const referralContact = data.allContacts.find(c => c.id === clientReferredBy)
            if (referralContact) {
              setSelectedReferral({
                id: referralContact.id,
                name: referralContact.name,
                email: referralContact.email,
              })
            }
          } else {
            setSelectedReferral(null)
          }
        })
        .catch(err => {
          console.error('Failed to fetch contact sheet data:', err)
        })
        .finally(() => {
          setIsLoadingContacts(false)
        })
    } else if (allContactsProp && clientReferredBy) {
      // Use provided contacts to find referral
      const referralContact = allContactsProp.find(c => c.id === clientReferredBy)
      if (referralContact) {
        setSelectedReferral({
          id: referralContact.id,
          name: referralContact.name,
          email: referralContact.email,
        })
      } else {
        setSelectedReferral(null)
      }
    } else {
      setSelectedReferral(null)
    }
  }, [open, resetFormState, startTransition, client?.id, client?.referred_by, allContactsProp, clientContactsProp])

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        confirmDiscard(() => {
          startTransition(() => {
            resetFormState()
          })
          onOpenChange(false)
        })
        return
      }

      onOpenChange(next)
    },
    [confirmDiscard, onOpenChange, resetFormState, startTransition]
  )

  // Contact handlers
  const handleContactPickerOpenChange = useCallback(
    (next: boolean) => {
      if (contactsAddButtonDisabled) {
        setIsContactPickerOpen(false)
        return
      }
      setIsContactPickerOpen(next)
    },
    [contactsAddButtonDisabled]
  )

  const handleAddContact = useCallback((contact: ClientContactOption) => {
    setSelectedContacts(prev => {
      if (prev.some(existing => existing.id === contact.id)) {
        return prev
      }
      return [...prev, contact]
    })
    setIsContactPickerOpen(false)
  }, [])

  const handleRemoveContact = useCallback((contact: ClientContactOption) => {
    setSelectedContacts(prev => prev.filter(c => c.id !== contact.id))
  }, [])

  // Referral handlers
  const handleReferralPickerOpenChange = useCallback(
    (next: boolean) => {
      if (referralPickerDisabled) {
        setIsReferralPickerOpen(false)
        return
      }
      setIsReferralPickerOpen(next)
    },
    [referralPickerDisabled]
  )

  const handleSelectReferral = useCallback((contact: ReferralContactOption) => {
    setSelectedReferral(contact)
    setIsReferralPickerOpen(false)
  }, [])

  const handleClearReferral = useCallback(() => {
    setSelectedReferral(null)
  }, [])

  const handleFormSubmit = useCallback(
    (values: ClientSheetFormValues) => {
      if (isEditing && !values.slug?.trim()) {
        form.setError('slug', { type: 'manual', message: 'Slug is required' })
        return
      }

      startTransition(async () => {
        setFeedback(null)

        const payload = {
          id: client?.id ?? undefined,
          name: values.name.trim(),
          slug: isEditing
            ? values.slug?.trim()
              ? values.slug.trim()
              : null
            : null,
          billingType: values.billingType,
          state: values.state?.trim() ? values.state.trim() : null,
          website: values.website?.trim() ? values.website.trim() : null,
          referredBy: selectedReferral?.id ?? null,
          notes: values.notes?.trim() ? values.notes.trim() : null,
        } satisfies Parameters<typeof saveClient>[0]

        if (payload.slug && payload.slug.length < 3) {
          setFeedback('Slug must be at least 3 characters when provided.')
          return
        }

        const interaction = startSettingsInteraction({
          entity: 'client',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
        })

        try {
          const result = await saveClient(payload)

          if (result.error) {
            finishSettingsInteraction(interaction, {
              status: 'error',
              error: result.error,
            })
            setFeedback(result.error)
            return
          }

          // Sync contact links if contacts changed
          // For new clients, use the returned clientId; for existing, use payload.id
          const clientIdForContacts = payload.id ?? result.clientId
          if (clientIdForContacts && contactsDirty) {
            const contactIds = selectedContacts.map(c => c.id)
            const syncResult = await syncClientContacts(clientIdForContacts, contactIds)

            if (!syncResult.ok) {
              setFeedback(syncResult.error ?? 'Failed to update contact links.')
              toast({
                title: 'Warning',
                description: 'Client saved but contact links could not be updated.',
                variant: 'destructive',
              })
              // Still complete since the client was saved
            }
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: payload.id ?? result.clientId ?? null,
          })

          toast({
            title: isEditing ? 'Client updated' : 'Client created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The client is ready for new projects.',
          })

          setInitialContacts(selectedContacts)
          setInitialReferralId(selectedReferral?.id ?? null)
          form.reset({
            name: payload.name,
            slug: payload.slug ?? '',
            billingType: payload.billingType,
            state: payload.state ?? '',
            website: payload.website ?? '',
            notes: payload.notes ?? '',
          })

          onOpenChange(false)
          onComplete()
        } catch (error) {
          finishSettingsInteraction(interaction, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          setFeedback('We could not save this client. Please try again.')
          return
        }
      })
    },
    [
      client?.id,
      contactsDirty,
      form,
      isEditing,
      onComplete,
      onOpenChange,
      selectedContacts,
      selectedReferral,
      setFeedback,
      startTransition,
      toast,
    ]
  )

  return {
    form,
    submitDisabled,
    submitDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    // Contacts
    availableContacts,
    selectedContacts,
    isContactPickerOpen,
    contactsAddButtonDisabled,
    contactsAddButtonDisabledReason,
    isLoadingContacts,
    handleContactPickerOpenChange,
    handleAddContact,
    handleRemoveContact,
    // Referral
    selectedReferral,
    availableReferralContacts,
    isReferralPickerOpen,
    referralPickerDisabled,
    referralPickerDisabledReason,
    handleReferralPickerOpenChange,
    handleSelectReferral,
    handleClearReferral,
  }
}
