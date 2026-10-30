import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { getClientSheetContactData } from '@/app/(dashboard)/companies/billing-actions'
import { subscribeSheetCreated } from '@/lib/sheets/created'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

import { PENDING_REASON } from '@/lib/forms/form-controls'
import { isSelectableUser } from '@/lib/users/selectable'
import type { CompanyBillingFields } from '@/lib/companies/sheet-save-schema'
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
  ClientContactOption,
  CloserCandidate,
  CloserDraft,
  OriginationContactOption,
  PartnerUserOption,
  UseClientBillingFormArgs,
  UseClientBillingFormReturn,
} from './types'

/** Which picker opened the person create sheet — gets the new record. */
type ContactCreateTarget = 'origination' | 'closer'

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

export function useClientBillingForm({
  open,
  client,
  isPending,
}: UseClientBillingFormArgs): UseClientBillingFormReturn {
  const [allContacts, setAllContacts] = useState<ClientContactOption[]>([])
  const [allAdminUsers, setAllAdminUsers] = useState<PartnerUserOption[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const { openNew } = useSheetParams()

  // Origination — one picker offers admins and contacts; whichever is
  // selected determines the kind, so the two selections are mutually exclusive.
  const [isOriginationPickerOpen, setIsOriginationPickerOpen] = useState(false)
  const [selectedOriginationUser, setSelectedOriginationUser] =
    useState<PartnerUserOption | null>(null)
  const [selectedOriginationContact, setSelectedOriginationContact] =
    useState<OriginationContactOption | null>(null)
  const initialOriginationUserId = client?.origination_user_id ?? null
  const initialOriginationContactId = client?.origination_contact_id ?? null

  // Closers — seeded from the client row (no fetch needed).
  const savedClosers = client?.closers ?? EMPTY_CLOSERS
  const [isCloserPickerOpen, setIsCloserPickerOpen] = useState(false)
  const [closers, setClosers] = useState<CloserDraft[]>(() =>
    toCloserDrafts(savedClosers)
  )
  const initialClosers = useMemo(
    () =>
      savedClosers.map(c => ({
        kind: c.kind,
        id: c.id,
        sharePercent: c.sharePercent,
      })),
    [savedClosers]
  )
  // Field-level error for the closer split, cleared as the user edits.
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
      notes: client?.notes ?? '',
      companyId: client?.company_id ?? '',
    },
  })

  const availableOriginationUsers = useMemo<PartnerUserOption[]>(
    () =>
      allAdminUsers.filter(
        u => isSelectableUser(u) && u.id !== selectedOriginationUser?.id
      ),
    [allAdminUsers, selectedOriginationUser]
  )
  const availableOriginationContacts = useMemo<OriginationContactOption[]>(
    () =>
      allContacts
        .filter(c => c.id !== selectedOriginationContact?.id)
        .map(c => ({ id: c.id, name: c.name, email: c.email })),
    [allContacts, selectedOriginationContact]
  )

  // A person can close too — e.g. an insider at the client who pushed the
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
          name: c.name?.trim() || c.email || 'Unnamed person',
          email: c.email,
        })),
    [allContacts, closerKeys]
  )

  const closerShares = useMemo(() => toCloserShares(closers), [closers])
  const closerShareTotal = closerShares.some(c => Number.isNaN(c.sharePercent))
    ? null
    : closerSharesTotal(closerShares)

  const originationDirty =
    (selectedOriginationUser?.id ?? null) !== initialOriginationUserId ||
    (selectedOriginationContact?.id ?? null) !== initialOriginationContactId
  const closerDirty = !closerSplitsEqual(closerShares, initialClosers)
  // Closer + origination are one effective-dated commission term (PRD 007).
  const commissionDirty = originationDirty || closerDirty
  const hasUnsavedChanges = form.formState.isDirty || commissionDirty

  const pickerDisabled = isPending || isLoadingContacts
  const pickerDisabledReason = pickerDisabled
    ? isPending
      ? PENDING_REASON
      : 'Loading people...'
    : null

  // Load the pickers' people once the sheet opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect starts */
    setIsLoadingContacts(true)
    getClientSheetContactData(client?.id)
      .then(data => {
        if (cancelled) return
        setAllContacts(data.allContacts)
        setAllAdminUsers(data.allAdminUsers)
        const contact = initialOriginationContactId
          ? data.allContacts.find(c => c.id === initialOriginationContactId)
          : null
        setSelectedOriginationContact(
          contact
            ? { id: contact.id, name: contact.name, email: contact.email }
            : null
        )
        setSelectedOriginationUser(
          initialOriginationUserId
            ? (data.allAdminUsers.find(
                u => u.id === initialOriginationUserId
              ) ?? null)
            : null
        )
      })
      .catch(err => {
        console.error('Failed to fetch billing picker data:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContacts(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, client?.id, initialOriginationContactId, initialOriginationUserId])

  // Create-from-picker: stack the person create sheet on top; the
  // subscription below hands the saved record to whichever picker asked.
  const createContactTargetRef = useRef<ContactCreateTarget>('origination')
  const requestContactCreate = useCallback(
    (target: ContactCreateTarget, query: string) => {
      createContactTargetRef.current = target
      setIsOriginationPickerOpen(false)
      setIsCloserPickerOpen(false)
      openNew('contact', query ? { contactName: query } : undefined)
    },
    [openNew]
  )
  const handleCreateOriginationContact = useCallback(
    (query: string) => requestContactCreate('origination', query),
    [requestContactCreate]
  )
  const handleCreateCloserContact = useCallback(
    (query: string) => requestContactCreate('closer', query),
    [requestContactCreate]
  )

  const handleOriginationPickerOpenChange = useCallback(
    (next: boolean) => setIsOriginationPickerOpen(pickerDisabled ? false : next),
    [pickerDisabled]
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

  const handleCloserPickerOpenChange = useCallback(
    (next: boolean) => setIsCloserPickerOpen(pickerDisabled ? false : next),
    [pickerDisabled]
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
      setAllContacts(prev =>
        prev.some(c => c.id === option.id) ? prev : [...prev, option]
      )
      if (createContactTargetRef.current === 'closer') {
        handleAddCloser({
          kind: 'contact',
          id: option.id,
          name: option.name?.trim() || option.email || 'Unnamed person',
          email: option.email,
        })
      } else {
        handleSelectOriginationContact({
          id: option.id,
          name: option.name,
          email: option.email,
        })
      }
    })
  }, [open, handleAddCloser, handleSelectOriginationContact])

  const collectFields = useCallback((): CompanyBillingFields | null => {
    // Origination and closers are both optional. With no closer the closer
    // share stays in house (estimated) on the Monthly Close (PRD 007).
    const splitError = closerSplitError(closerShares)
    if (splitError) {
      setCloserError(splitError)
      return null
    }
    setCloserError(null)
    const values = form.getValues()
    return {
      billingType: values.billingType,
      billingEffective: values.billingEffective,
      state: values.state?.trim() ? values.state.trim() : null,
      slug: values.slug?.trim() ? values.slug.trim() : null,
      originationUserId: selectedOriginationUser?.id ?? null,
      originationContactId: selectedOriginationContact?.id ?? null,
      closers: closerShares,
      commissionEffective: values.commissionEffective,
    }
  }, [closerShares, form, selectedOriginationContact, selectedOriginationUser])

  return {
    form,
    hasUnsavedChanges,
    isPending,
    pendingReason: PENDING_REASON,
    collectFields,
    handleCreateOriginationContact,
    handleCreateCloserContact,
    selectedOriginationUser,
    selectedOriginationContact,
    availableOriginationUsers,
    availableOriginationContacts,
    isOriginationPickerOpen,
    originationPickerDisabled: pickerDisabled,
    originationPickerDisabledReason: pickerDisabledReason,
    handleOriginationPickerOpenChange,
    handleSelectOriginationUser,
    handleSelectOriginationContact,
    handleClearOrigination,
    closers,
    availableCloserUsers,
    availableCloserContacts,
    closerShareTotal,
    isCloserPickerOpen,
    closerPickerDisabled: pickerDisabled,
    closerPickerDisabledReason: pickerDisabledReason,
    closerError,
    commissionDirty,
    handleCloserPickerOpenChange,
    handleAddCloser,
    handleRemoveCloser,
    handleCloserShareChange,
  }
}
