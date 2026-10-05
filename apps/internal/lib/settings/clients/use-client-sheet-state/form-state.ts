import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  saveClient,
  getClientSheetContactData,
  syncClientContacts,
} from '@/app/(dashboard)/clients/actions'
import { subscribeSheetCreated } from '@/lib/sheets/created'
import { useSheetLifecycle } from '@/lib/sheets/use-sheet-lifecycle'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import {
  finishSettingsInteraction,
  startSettingsInteraction,
} from '@/lib/posthog/settings'

import { PENDING_REASON } from '../client-sheet-constants'
import { isSelectableUser } from '@/lib/users/selectable'
import {
  clientSheetFormSchema,
  type ClientSheetFormValues,
} from '../client-sheet-schema'

import {
  closerKey,
  closerSplitError,
  closerSplitsEqual,
  closerSharesTotal,
  evenCloserShares,
  type ClientCloser,
  type CloserShare,
} from '../closers'

import type {
  BaseFormState,
  ClientContactOption,
  ClientSheetFormStateArgs,
  CloserCandidate,
  CloserDraft,
  OriginationContactOption,
  PartnerUserOption,
} from './types'

/** Which picker opened the contact create sheet — gets the new record. */
type ContactCreateTarget = 'contacts' | 'origination' | 'closer'

function primaryIdOf(linked: ClientContactOption[]): string | null {
  return linked.find(contact => contact.isPrimary)?.id ?? null
}

const EMPTY_CLOSERS: ClientCloser[] = []

function toCloserDrafts(closers: readonly ClientCloser[]): CloserDraft[] {
  return closers.map(closer => ({
    kind: closer.kind,
    id: closer.id,
    name: closer.name,
    email: closer.email,
    shareText: String(closer.sharePercent),
  }))
}

/** Re-split evenly — adding or removing a closer resets hand-tuned shares. */
function withEvenShares(drafts: CloserDraft[]): CloserDraft[] {
  const shares = evenCloserShares(drafts.length)
  return drafts.map((draft, index) => ({
    ...draft,
    shareText: String(shares[index]),
  }))
}

/** A lone closer always takes 100; unparseable text becomes NaN (invalid). */
function toCloserShares(drafts: readonly CloserDraft[]): CloserShare[] {
  return drafts.map(draft => ({
    kind: draft.kind,
    id: draft.id,
    sharePercent:
      drafts.length === 1
        ? 100
        : draft.shareText.trim() === ''
          ? Number.NaN
          : Number(draft.shareText),
  }))
}

export function useClientSheetFormState({
  open,
  onOpenChange,
  onComplete,
  client,
  allContacts: allContactsProp,
  clientContacts: clientContactsProp,
  allAdminUsers: allAdminUsersProp,
  initialName,
  onCreated,
  isEditing,
  setFeedback,
  toast,
}: ClientSheetFormStateArgs): BaseFormState {
  // Contact state
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false)
  const [fetchedAllContacts, setFetchedAllContacts] = useState<
    ClientContactOption[]
  >([])
  const [fetchedAllAdminUsers, setFetchedAllAdminUsers] = useState<
    PartnerUserOption[]
  >([])
  const [selectedContacts, setSelectedContacts] = useState<
    ClientContactOption[]
  >([])
  const [initialContacts, setInitialContacts] = useState<ClientContactOption[]>(
    []
  )
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null)
  const [initialPrimaryContactId, setInitialPrimaryContactId] = useState<
    string | null
  >(null)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  // Contacts created from inside the picker this session — the fetched list
  // predates them, so they're merged in to stay re-selectable after removal.
  const [createdContacts, setCreatedContacts] = useState<ClientContactOption[]>(
    []
  )
  const { openNew } = useSheetParams()

  // Origination state — one picker offers admins and contacts; whichever is
  // selected determines the kind, so the two selections are mutually exclusive.
  const [isOriginationPickerOpen, setIsOriginationPickerOpen] = useState(false)
  const [selectedOriginationUser, setSelectedOriginationUser] =
    useState<PartnerUserOption | null>(null)
  const [selectedOriginationContact, setSelectedOriginationContact] =
    useState<OriginationContactOption | null>(null)
  const [initialOriginationUserId, setInitialOriginationUserId] = useState<
    string | null
  >(null)
  const [initialOriginationContactId, setInitialOriginationContactId] =
    useState<string | null>(null)

  // Closer state — seeded from the client row on open (no fetch needed).
  const [isCloserPickerOpen, setIsCloserPickerOpen] = useState(false)
  const [closers, setClosers] = useState<CloserDraft[]>([])
  const [initialClosers, setInitialClosers] = useState<CloserShare[]>([])

  // Field-level error for the closer split — rendered inline (shadcn
  // FormMessage pattern) below the editor. Cleared as the user interacts
  // so it doesn't linger after a fix.
  const [closerError, setCloserError] = useState<string | null>(null)

  const form = useForm<ClientSheetFormValues>({
    resolver: zodResolver(clientSheetFormSchema),
    defaultValues: {
      name: client?.name ?? '',
      slug: client?.slug ?? '',
      billingType: client?.billing_type ?? 'prepaid',
      billingEffective: 'next_month',
      commissionEffective: 'next_month',
      state: client?.state ?? '',
      website: client?.website ?? '',
      notes: client?.notes ?? '',
    },
  })

  // Use provided data or fetched data
  const baseContacts = allContactsProp ?? fetchedAllContacts
  const allContacts = useMemo(() => {
    if (createdContacts.length === 0) return baseContacts
    const known = new Set(baseContacts.map(c => c.id))
    return [...baseContacts, ...createdContacts.filter(c => !known.has(c.id))]
  }, [baseContacts, createdContacts])
  const allAdminUsers = allAdminUsersProp ?? fetchedAllAdminUsers

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
    return primaryContactId !== initialPrimaryContactId
  }, [
    initialContacts,
    selectedContacts,
    primaryContactId,
    initialPrimaryContactId,
  ])

  // Origination user picker: any selectable admin except the one already
  // selected. Disabled admins stay in `allAdminUsers` so an existing
  // origination/closer still resolves for display, but are never offered.
  const availableOriginationUsers = useMemo<PartnerUserOption[]>(() => {
    return allAdminUsers.filter(
      u => isSelectableUser(u) && u.id !== selectedOriginationUser?.id
    )
  }, [allAdminUsers, selectedOriginationUser])

  // Origination contact picker: any contact except the one already selected
  const availableOriginationContacts = useMemo<OriginationContactOption[]>(
    () =>
      allContacts
        .filter(c => c.id !== selectedOriginationContact?.id)
        .map(c => ({ id: c.id, name: c.name, email: c.email })),
    [allContacts, selectedOriginationContact]
  )

  // Closer picker: selectable admins and any contact, minus current closers.
  // A contact can close too — e.g. an insider at the client who pushed the
  // deal over the line.
  const closerKeys = useMemo(() => new Set(closers.map(closerKey)), [closers])
  const availableCloserUsers = useMemo<CloserCandidate[]>(
    () =>
      allAdminUsers
        .filter(u => isSelectableUser(u) && !closerKeys.has(`user:${u.id}`))
        .map(u => ({
          kind: 'user' as const,
          id: u.id,
          name: u.fullName?.trim() || u.email,
          email: u.email,
        })),
    [allAdminUsers, closerKeys]
  )
  const availableCloserContacts = useMemo<CloserCandidate[]>(
    () =>
      allContacts
        .filter(c => !closerKeys.has(`contact:${c.id}`))
        .map(c => ({
          kind: 'contact' as const,
          id: c.id,
          name: c.name?.trim() || c.email,
          email: c.email,
        })),
    [allContacts, closerKeys]
  )

  const closerShares = useMemo(() => toCloserShares(closers), [closers])
  const closerShareTotal = closerShares.some(c => Number.isNaN(c.sharePercent))
    ? null
    : closerSharesTotal(closerShares)

  // Origination dirty: either side differs from initial
  const originationDirty = useMemo(() => {
    const currentUserId = selectedOriginationUser?.id ?? null
    const currentContactId = selectedOriginationContact?.id ?? null
    return (
      currentUserId !== initialOriginationUserId ||
      currentContactId !== initialOriginationContactId
    )
  }, [
    selectedOriginationUser,
    selectedOriginationContact,
    initialOriginationUserId,
    initialOriginationContactId,
  ])

  const closerDirty = !closerSplitsEqual(closerShares, initialClosers)

  // Closer + origination are one effective-dated commission term (PRD 007);
  // the form reveals the boundary select when either side changed.
  const commissionDirty = originationDirty || closerDirty

  const resetFormState = useCallback(() => {
    const defaults = {
      name: client?.name ?? initialName ?? '',
      slug: client?.slug ?? '',
      billingType: client?.billing_type ?? 'prepaid',
      billingEffective: 'next_month' as const,
      commissionEffective: 'next_month' as const,
      state: client?.state ?? '',
      website: client?.website ?? '',
      notes: client?.notes ?? '',
    }

    form.reset(defaults)
    setFeedback(null)
    setCloserError(null)

    // Reset pickers
    setIsContactPickerOpen(false)
    setIsOriginationPickerOpen(false)
    setIsCloserPickerOpen(false)
  }, [client, form, initialName, setFeedback])

  const hasUnsavedChanges =
    form.formState.isDirty || contactsDirty || originationDirty || closerDirty

  const {
    isSaving: isPending,
    startSave,
    handleSheetOpenChange,
    unsavedChangesDialog,
  } = useSheetLifecycle({
    open,
    onOpenChange,
    isDirty: hasUnsavedChanges,
    onReset: resetFormState,
    resetKey: client?.id ?? null,
  })

  // Never disabled for an empty list: the picker's create row is the escape
  // hatch when every contact is linked (or none exist yet).
  const contactsAddButtonDisabled = isPending || isLoadingContacts
  const contactsAddButtonDisabledReason = contactsAddButtonDisabled
    ? isPending
      ? PENDING_REASON
      : isLoadingContacts
        ? 'Loading contacts...'
        : null
    : null

  const originationPickerDisabled = isPending || isLoadingContacts
  const originationPickerDisabledReason = originationPickerDisabled
    ? isPending
      ? PENDING_REASON
      : 'Loading contacts...'
    : null

  const closerPickerDisabled = isPending || isLoadingContacts
  const closerPickerDisabledReason = closerPickerDisabled
    ? isPending
      ? PENDING_REASON
      : 'Loading contacts...'
    : null

  const submitDisabled = isPending
  const submitDisabledReason = submitDisabled ? PENDING_REASON : null

  useEffect(() => {
    if (!open) {
      return
    }

    // Initialize contacts from props if provided
    // Intentional: Sync contact state with props when sheet opens
    /* eslint-disable react-hooks/set-state-in-effect */
    const linkedFromProps = clientContactsProp ?? []
    const primaryFromProps = primaryIdOf(linkedFromProps)
    setSelectedContacts(linkedFromProps)
    setInitialContacts(linkedFromProps)
    setPrimaryContactId(primaryFromProps)
    setInitialPrimaryContactId(primaryFromProps)
    /* eslint-enable react-hooks/set-state-in-effect */

    // Fetch contact data if not provided via props
    const clientId = client?.id
    const clientOriginationContactId = client?.origination_contact_id ?? null
    const clientOriginationUserId = client?.origination_user_id ?? null
    const clientClosers = client?.closers ?? EMPTY_CLOSERS
    const shouldFetch =
      !allContactsProp ||
      allContactsProp.length === 0 ||
      !allAdminUsersProp ||
      allAdminUsersProp.length === 0

    // Initialize origination/closer "initial" references
    setInitialOriginationUserId(clientOriginationUserId)
    setInitialOriginationContactId(clientOriginationContactId)
    setClosers(toCloserDrafts(clientClosers))
    setInitialClosers(
      clientClosers.map(c => ({
        kind: c.kind,
        id: c.id,
        sharePercent: c.sharePercent,
      }))
    )

    const hydrateSelectionsFromData = (
      contacts: ClientContactOption[],
      adminUsers: PartnerUserOption[]
    ) => {
      // Origination contact
      if (clientOriginationContactId) {
        const contact = contacts.find(c => c.id === clientOriginationContactId)
        setSelectedOriginationContact(
          contact
            ? { id: contact.id, name: contact.name, email: contact.email }
            : null
        )
      } else {
        setSelectedOriginationContact(null)
      }

      // Origination user
      if (clientOriginationUserId) {
        const u = adminUsers.find(u => u.id === clientOriginationUserId)
        setSelectedOriginationUser(u ?? null)
      } else {
        setSelectedOriginationUser(null)
      }
    }

    if (shouldFetch) {
      setIsLoadingContacts(true)
      getClientSheetContactData(clientId)
        .then(data => {
          setFetchedAllContacts(data.allContacts)
          setFetchedAllAdminUsers(data.allAdminUsers)
          if (clientId && data.linkedContacts.length > 0) {
            const primaryId = primaryIdOf(data.linkedContacts)
            setSelectedContacts(data.linkedContacts)
            setInitialContacts(data.linkedContacts)
            setPrimaryContactId(primaryId)
            setInitialPrimaryContactId(primaryId)
          }
          hydrateSelectionsFromData(data.allContacts, data.allAdminUsers)
        })
        .catch(err => {
          console.error('Failed to fetch contact sheet data:', err)
        })
        .finally(() => {
          setIsLoadingContacts(false)
        })
    } else {
      hydrateSelectionsFromData(allContactsProp ?? [], allAdminUsersProp ?? [])
    }
  }, [
    open,
    client?.id,
    client?.origination_contact_id,
    client?.origination_user_id,
    client?.closers,
    allContactsProp,
    clientContactsProp,
    allAdminUsersProp,
  ])

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
    setPrimaryContactId(prev => (prev === contact.id ? null : prev))
  }, [])

  const handleTogglePrimaryContact = useCallback(
    (contact: ClientContactOption) => {
      setPrimaryContactId(prev => (prev === contact.id ? null : contact.id))
    },
    []
  )

  // Create-from-picker: stack the contact create sheet on top of this one
  // (`?client=…&contact=new`); the subscription below hands the saved record
  // to whichever picker asked — only the contacts picker links it to the client.
  const createContactTargetRef = useRef<ContactCreateTarget>('contacts')
  const requestContactCreate = useCallback(
    (target: ContactCreateTarget, query: string) => {
      createContactTargetRef.current = target
      setIsContactPickerOpen(false)
      setIsOriginationPickerOpen(false)
      setIsCloserPickerOpen(false)
      openNew('contact', query ? { contactName: query } : undefined)
    },
    [openNew]
  )
  const handleCreateContact = useCallback(
    (query: string) => requestContactCreate('contacts', query),
    [requestContactCreate]
  )
  const handleCreateOriginationContact = useCallback(
    (query: string) => requestContactCreate('origination', query),
    [requestContactCreate]
  )
  const handleCreateCloserContact = useCallback(
    (query: string) => requestContactCreate('closer', query),
    [requestContactCreate]
  )

  // Origination handlers
  const handleOriginationPickerOpenChange = useCallback(
    (next: boolean) => {
      if (originationPickerDisabled) {
        setIsOriginationPickerOpen(false)
        return
      }
      setIsOriginationPickerOpen(next)
    },
    [originationPickerDisabled]
  )

  const handleSelectOriginationUser = useCallback((user: PartnerUserOption) => {
    setSelectedOriginationUser(user)
    setSelectedOriginationContact(null)
    setIsOriginationPickerOpen(false)
  }, [])

  const handleSelectOriginationContact = useCallback(
    (contact: OriginationContactOption) => {
      setSelectedOriginationContact(contact)
      setSelectedOriginationUser(null)
      setIsOriginationPickerOpen(false)
    },
    []
  )

  const handleClearOrigination = useCallback(() => {
    setSelectedOriginationUser(null)
    setSelectedOriginationContact(null)
  }, [])

  // Closer handlers
  const handleCloserPickerOpenChange = useCallback(
    (next: boolean) => {
      if (closerPickerDisabled) {
        setIsCloserPickerOpen(false)
        return
      }
      setIsCloserPickerOpen(next)
    },
    [closerPickerDisabled]
  )

  const handleAddCloser = useCallback((candidate: CloserCandidate) => {
    setClosers(prev =>
      prev.some(c => closerKey(c) === closerKey(candidate))
        ? prev
        : withEvenShares([...prev, { ...candidate, shareText: '' }])
    )
    setIsCloserPickerOpen(false)
    setCloserError(null)
  }, [])

  const handleRemoveCloser = useCallback((key: string) => {
    setClosers(prev => withEvenShares(prev.filter(c => closerKey(c) !== key)))
    setCloserError(null)
  }, [])

  const handleCloserShareChange = useCallback(
    (key: string, shareText: string) => {
      setClosers(prev =>
        prev.map(c => (closerKey(c) === key ? { ...c, shareText } : c))
      )
      setCloserError(null)
    },
    []
  )

  useEffect(() => {
    if (!open) return
    return subscribeSheetCreated('contact', record => {
      const option: ClientContactOption = {
        id: record.id,
        name: record.name,
        email: record.email,
        phone: record.phone,
        hasPortalAccess: false,
      }
      setCreatedContacts(prev =>
        prev.some(c => c.id === option.id) ? prev : [...prev, option]
      )
      switch (createContactTargetRef.current) {
        case 'origination':
          handleSelectOriginationContact({
            id: option.id,
            name: option.name,
            email: option.email,
          })
          break
        case 'closer':
          handleAddCloser({
            kind: 'contact',
            id: option.id,
            name: option.name?.trim() || option.email,
            email: option.email,
          })
          break
        default:
          handleAddContact(option)
      }
      createContactTargetRef.current = 'contacts'
    })
  }, [open, handleAddContact, handleSelectOriginationContact, handleAddCloser])

  const handleFormSubmit = useCallback(
    (values: ClientSheetFormValues) => {
      if (isEditing && !values.slug?.trim()) {
        form.setError('slug', { type: 'manual', message: 'Slug is required' })
        return
      }

      // Origination and closers are both optional. With no closer the closer
      // share stays in house (estimated) on the Monthly Close (PRD 007).
      const splitError = closerSplitError(closerShares)
      if (splitError) {
        setCloserError(splitError)
        return
      }

      setCloserError(null)

      startSave(async () => {
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
          billingEffective: values.billingEffective,
          commissionEffective: values.commissionEffective,
          state: values.state?.trim() ? values.state.trim() : null,
          website: values.website?.trim() ? values.website.trim() : null,
          originationContactId: selectedOriginationContact?.id ?? null,
          originationUserId: selectedOriginationUser?.id ?? null,
          closers: closerShares,
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
            const syncResult = await syncClientContacts(
              clientIdForContacts,
              contactIds,
              primaryContactId
            )

            if (!syncResult.ok) {
              setFeedback(syncResult.error ?? 'Unable to update contact links.')
              toast({
                title: 'Unable to update contact links',
                description:
                  'The client was saved, but its contact links were not.',
                variant: 'destructive',
              })
              // Still complete since the client was saved
            }
          }

          finishSettingsInteraction(interaction, {
            status: 'success',
            targetId: payload.id ?? result.clientId ?? null,
          })

          if (!isEditing && result.clientId && onCreated) {
            onCreated({
              id: result.clientId,
              name: payload.name,
              slug: result.slug ?? payload.slug ?? '',
            })
          }

          toast({
            title: isEditing ? 'Client updated' : 'Client created',
            description: isEditing
              ? 'Changes saved successfully.'
              : 'The client is ready for new projects.',
          })

          setInitialContacts(selectedContacts)
          setInitialPrimaryContactId(primaryContactId)
          setInitialOriginationUserId(payload.originationUserId)
          setInitialOriginationContactId(payload.originationContactId)
          setInitialClosers(payload.closers)
          form.reset({
            name: payload.name,
            slug: payload.slug ?? '',
            billingType: payload.billingType,
            billingEffective: 'next_month',
            commissionEffective: 'next_month',
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
      onCreated,
      onOpenChange,
      primaryContactId,
      closerShares,
      selectedContacts,
      selectedOriginationContact,
      selectedOriginationUser,
      setFeedback,
      startSave,
      toast,
    ]
  )

  return {
    form,
    isSaving: isPending,
    startSave,
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
    handleCreateContact,
    handleCreateOriginationContact,
    handleCreateCloserContact,
    primaryContactId,
    handleTogglePrimaryContact,
    // Origination
    selectedOriginationUser,
    selectedOriginationContact,
    availableOriginationUsers,
    availableOriginationContacts,
    isOriginationPickerOpen,
    originationPickerDisabled,
    originationPickerDisabledReason,
    handleOriginationPickerOpenChange,
    handleSelectOriginationUser,
    handleSelectOriginationContact,
    handleClearOrigination,
    // Closers
    closers,
    availableCloserUsers,
    availableCloserContacts,
    closerShareTotal,
    isCloserPickerOpen,
    closerPickerDisabled,
    closerPickerDisabledReason,
    closerError,
    commissionDirty,
    handleCloserPickerOpenChange,
    handleAddCloser,
    handleRemoveCloser,
    handleCloserShareChange,
  }
}
