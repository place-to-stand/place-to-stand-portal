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

import {
  CLIENT_MEMBERS_HELP_TEXT,
  NO_AVAILABLE_CLIENT_USERS_MESSAGE,
  PENDING_REASON,
} from '../client-sheet-constants'
import {
  attachDisplayName,
  cloneMembers,
  formatUserDisplayName,
  type ClientMember,
} from '../client-sheet-utils'
import {
  clientSheetFormSchema,
  type ClientSheetFormValues,
} from '../client-sheet-schema'

import type {
  BaseFormState,
  ClientContactOption,
  ClientMemberOption,
  ClientSheetFormStateArgs,
} from './types'

export function useClientSheetFormState({
  open,
  onOpenChange,
  onComplete,
  client,
  clientMembers,
  allClientUsers,
  allContacts: allContactsProp,
  clientContacts: clientContactsProp,
  isEditing,
  isPending,
  startTransition,
  setFeedback,
  toast,
}: ClientSheetFormStateArgs): BaseFormState {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [removalCandidate, setRemovalCandidate] = useState<ClientMember | null>(
    null
  )
  const [savedMemberIds, setSavedMemberIds] = useState<string[]>([])
  const [selectedMembers, setSelectedMembers] = useState<ClientMember[]>([])

  // Contact state
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false)
  const [fetchedAllContacts, setFetchedAllContacts] = useState<ClientContactOption[]>([])
  const [selectedContacts, setSelectedContacts] = useState<ClientContactOption[]>([])
  const [initialContacts, setInitialContacts] = useState<ClientContactOption[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  const initialMembers = useMemo(() => {
    if (!client) return [] as ClientMember[]
    const members = clientMembers[client.id] ?? []
    return members.map(attachDisplayName)
  }, [client, clientMembers])

  const allClientUserOptions = useMemo(
    () => allClientUsers.map(attachDisplayName),
    [allClientUsers]
  )

  const form = useForm<ClientSheetFormValues>({
    resolver: zodResolver(clientSheetFormSchema),
    defaultValues: {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      billingType: client?.billing_type ?? 'prepaid',
      notes: client?.notes ?? '',
    },
  })

  const availableMembers = useMemo(() => {
    const selectedIds = new Set(selectedMembers.map(member => member.id))
    return allClientUserOptions.filter(option => !selectedIds.has(option.id))
  }, [allClientUserOptions, selectedMembers])

  const membershipDirty = useMemo(() => {
    const currentIds = selectedMembers.map(member => member.id).sort()

    if (savedMemberIds.length !== currentIds.length) {
      return true
    }

    return savedMemberIds.some((id, index) => id !== currentIds[index])
  }, [savedMemberIds, selectedMembers])

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

  const addButtonDisabled = isPending || availableMembers.length === 0
  const addButtonDisabledReason = addButtonDisabled
    ? isPending
      ? PENDING_REASON
      : NO_AVAILABLE_CLIENT_USERS_MESSAGE
    : null

  const contactsAddButtonDisabled = isPending || isLoadingContacts || availableContacts.length === 0
  const contactsAddButtonDisabledReason = contactsAddButtonDisabled
    ? isPending
      ? PENDING_REASON
      : isLoadingContacts
        ? 'Loading contacts...'
        : 'All contacts are already linked.'
    : null

  const submitDisabled = isPending
  const submitDisabledReason = submitDisabled ? PENDING_REASON : null

  const hasUnsavedChanges = form.formState.isDirty || membershipDirty || contactsDirty

  const { requestConfirmation: confirmDiscard, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty: hasUnsavedChanges })

  const resetFormState = useCallback(() => {
    const defaults = {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      billingType: client?.billing_type ?? 'prepaid',
      notes: client?.notes ?? '',
    }

    const memberSnapshot = cloneMembers(initialMembers)

    form.reset(defaults)
    setSavedMemberIds(memberSnapshot.map(member => member.id).sort())
    setFeedback(null)
    setSelectedMembers(memberSnapshot)
    setRemovalCandidate(null)
    setIsPickerOpen(false)

    // Reset contacts
    setIsContactPickerOpen(false)
  }, [client, form, initialMembers, setFeedback])

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      resetFormState()
    })

    // Initialize contacts from props if provided
    if (clientContactsProp) {
      setSelectedContacts(clientContactsProp)
      setInitialContacts(clientContactsProp)
    } else {
      setSelectedContacts([])
      setInitialContacts([])
    }

    // Fetch contact data if not provided via props
    const clientId = client?.id
    const shouldFetch = !allContactsProp || allContactsProp.length === 0

    if (shouldFetch) {
      setIsLoadingContacts(true)
      getClientSheetContactData(clientId)
        .then(data => {
          setFetchedAllContacts(data.allContacts)
          if (clientId && data.linkedContacts.length > 0) {
            setSelectedContacts(data.linkedContacts)
            setInitialContacts(data.linkedContacts)
          }
        })
        .catch(err => {
          console.error('Failed to fetch contact sheet data:', err)
        })
        .finally(() => {
          setIsLoadingContacts(false)
        })
    }
  }, [open, resetFormState, startTransition, client?.id, allContactsProp, clientContactsProp])

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

  const handlePickerOpenChange = useCallback(
    (next: boolean) => {
      if (addButtonDisabled) {
        setIsPickerOpen(false)
        return
      }
      setIsPickerOpen(next)
    },
    [addButtonDisabled]
  )

  const handleAddMember = useCallback((member: ClientMemberOption) => {
    setSelectedMembers(prev => {
      if (prev.some(existing => existing.id === member.id)) {
        return prev
      }
      return [...prev, member]
    })
    setIsPickerOpen(false)
  }, [])

  const handleRequestRemoval = useCallback((member: ClientMemberOption) => {
    setRemovalCandidate(member)
  }, [])

  const handleCancelRemoval = useCallback(() => {
    setRemovalCandidate(null)
  }, [])

  const handleConfirmRemoval = useCallback(() => {
    if (!removalCandidate) {
      return
    }

    const removalId = removalCandidate.id
    setSelectedMembers(prev => prev.filter(member => member.id !== removalId))
    setRemovalCandidate(null)
  }, [removalCandidate])

  const replaceMembers = useCallback((members: ClientMemberOption[]) => {
    setSelectedMembers(cloneMembers(members))
    setRemovalCandidate(null)
    setIsPickerOpen(false)
  }, [])

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
          notes: values.notes?.trim() ? values.notes.trim() : null,
          memberIds: selectedMembers.map(member => member.id),
        } satisfies Parameters<typeof saveClient>[0]

        if (payload.slug && payload.slug.length < 3) {
          setFeedback('Slug must be at least 3 characters when provided.')
          return
        }

        const interaction = startSettingsInteraction({
          entity: 'client',
          mode: isEditing ? 'edit' : 'create',
          targetId: payload.id ?? null,
          metadata: {
            hasMembers: payload.memberIds.length > 0,
          },
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

          // Sync contact links if editing and contacts changed
          // (For new clients, contacts can be linked after creation via the edit flow)
          if (payload.id && contactsDirty) {
            const contactIds = selectedContacts.map(c => c.id)
            const syncResult = await syncClientContacts(payload.id, contactIds)

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
            targetId: payload.id ?? null,
          })

          toast({
            title: isEditing ? 'Client updated' : 'Client created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The client is ready for new projects.',
          })

          setSavedMemberIds(selectedMembers.map(member => member.id).sort())
          setInitialContacts(selectedContacts)
          form.reset({
            name: payload.name,
            slug: payload.slug ?? '',
            billingType: payload.billingType,
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
      selectedMembers,
      setFeedback,
      startTransition,
      toast,
    ]
  )

  const removalName = removalCandidate
    ? formatUserDisplayName(removalCandidate)
    : null

  return {
    form,
    addButtonDisabled,
    addButtonDisabledReason,
    submitDisabled,
    submitDisabledReason,
    availableMembers,
    selectedMembers,
    membersHelpText: CLIENT_MEMBERS_HELP_TEXT,
    isPickerOpen,
    removalCandidate,
    removalName,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handlePickerOpenChange,
    handleAddMember,
    handleRequestRemoval,
    handleCancelRemoval,
    handleConfirmRemoval,
    replaceMembers,
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
  }
}
