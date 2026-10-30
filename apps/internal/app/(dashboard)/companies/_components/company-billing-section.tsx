'use client'

import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  type ReactNode,
  type Ref,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Skeleton } from '@pts/ui/skeleton'
import { FormFeedback } from '@/components/sheets/form-feedback'
import { SheetSection } from '@/components/sheets/sheet-section'
import { Form } from '@/components/ui/form'
import { ClientBillingFields } from '@/app/(dashboard)/clients/_components/client-sheet/client-billing-fields'
import {
  ClientPortalAccessList,
  PortalAccessControl,
} from '@/app/(dashboard)/clients/_components/client-sheet/client-contact-picker'
import {
  ARCHIVE_CLIENT_CONFIRM_LABEL,
  ARCHIVE_CLIENT_DIALOG_TITLE,
  getArchiveClientDialogDescription,
} from '@/lib/settings/clients/client-sheet-constants'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import {
  useClientSheetState,
  type UseClientSheetStateReturn,
} from '@/lib/settings/clients/use-client-sheet-state'

/** What the company sheet needs from its client's billing form. */
export type CompanyBillingHandle = {
  /** Billing, commission or portal access has unsaved edits. */
  isDirty: () => boolean
  /** Saves the billing edits; `onSaved` fires when done. */
  submit: () => void
  /** Asks to archive the client (stop billing). */
  requestStopBilling: () => void
}

type BillingContextValue =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; client: ClientRow; state: UseClientSheetStateReturn }

const BillingContext = createContext<BillingContextValue>({ status: 'none' })

/** The company's client billing state, for its Billing tab and People rows. */
export const useCompanyBilling = () => useContext(BillingContext)

type CompanyBillingProviderProps = {
  /** The company's live client; null when it isn't one (or not an admin). */
  clientId: string | null
  open: boolean
  /** Fires after a billing save or after billing stops. */
  onSaved: () => void
  /** Keeps the company sheet's unsaved-changes guard in step. */
  onDirtyChange: (dirty: boolean) => void
  handleRef: Ref<CompanyBillingHandle>
  children: ReactNode
}

async function fetchClientBilling(clientId: string): Promise<ClientRow> {
  const response = await fetch(
    `/api/sheets/init?entity=client&id=${encodeURIComponent(clientId)}`
  )
  const result = (await response.json()) as
    | { ok: true; data: { client: ClientRow | null } }
    | { ok: false; error?: string }
  if (!result.ok || !result.data.client) {
    throw new Error(result.ok ? 'Client not found' : result.error)
  }
  return result.data.client
}

/**
 * A client is its company's billing record, so its billing form lives inside
 * the company sheet. One provider holds that form for every tab: the Billing
 * tab edits it, the People rows switch portal access, and the company's Save
 * saves it.
 */
export function CompanyBillingProvider(props: CompanyBillingProviderProps) {
  const { clientId, children } = props
  const { data: client, isError } = useQuery({
    queryKey: ['clientBilling', clientId],
    queryFn: () => fetchClientBilling(clientId!),
    enabled: Boolean(clientId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  if (!clientId) {
    return (
      <BillingContext.Provider value={{ status: 'none' }}>
        {children}
      </BillingContext.Provider>
    )
  }
  if (isError || !client) {
    return (
      <BillingContext.Provider
        value={{ status: isError ? 'error' : 'loading' }}
      >
        {children}
      </BillingContext.Provider>
    )
  }
  return (
    <LoadedBillingProvider key={client.updated_at} client={client} {...props} />
  )
}

function LoadedBillingProvider({
  client,
  open,
  onSaved,
  onDirtyChange,
  handleRef,
  children,
}: CompanyBillingProviderProps & { client: ClientRow }) {
  const state = useClientSheetState({
    open,
    onOpenChange: () => {},
    onComplete: onSaved,
    onArchived: onSaved,
    client,
    quietSuccess: true,
  })

  const dirty = state.hasUnsavedChanges
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useImperativeHandle(
    handleRef,
    () => ({
      isDirty: () => state.hasUnsavedChanges,
      submit: () => void state.form.handleSubmit(state.handleFormSubmit)(),
      requestStopBilling: state.handleRequestDelete,
    }),
    [state]
  )

  return (
    <BillingContext.Provider value={{ status: 'ready', client, state }}>
      {children}
      <ConfirmDialog
        open={state.isDeleteDialogOpen}
        title={ARCHIVE_CLIENT_DIALOG_TITLE}
        description={getArchiveClientDialogDescription(state.clientDisplayName)}
        confirmLabel={ARCHIVE_CLIENT_CONFIRM_LABEL}
        confirmVariant='destructive'
        confirmDisabled={state.isPending}
        onCancel={state.handleCancelDelete}
        onConfirm={state.handleConfirmDelete}
      />
    </BillingContext.Provider>
  )
}

/** The Billing tab's form: billing type and state, then commission. */
export function CompanyBillingFields() {
  const billing = useCompanyBilling()

  if (billing.status === 'error') {
    return (
      <p className='text-muted-foreground text-sm'>
        Billing could not be loaded. Reload to try again.
      </p>
    )
  }
  if (billing.status !== 'ready') {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    )
  }

  const { client, state } = billing
  const companyIds = new Set(
    [...state.selectedContacts, ...state.availableContacts]
      .filter(contact => contact.companyId === client.company_id)
      .map(contact => contact.id)
  )
  const outsiders = state.selectedContacts.filter(
    contact => !companyIds.has(contact.id)
  )

  return (
    <Form {...state.form}>
      <ClientBillingFields
        form={state.form}
        isPending={state.isPending}
        isEditing
        showPortalAccess={false}
        initialBillingType={client.billing_type ?? null}
        pendingReason={state.pendingReason}
        selectedContacts={state.selectedContacts}
        availableContacts={state.availableContacts}
        contactsAddButtonDisabled={state.contactsAddButtonDisabled}
        contactsAddButtonDisabledReason={state.contactsAddButtonDisabledReason}
        onAddContact={state.handleAddContact}
        onCreateOriginationContact={state.handleCreateOriginationContact}
        onCreateCloserContact={state.handleCreateCloserContact}
        onRemoveContact={state.handleRemoveContact}
        selectedOriginationUser={state.selectedOriginationUser}
        selectedOriginationContact={state.selectedOriginationContact}
        availableOriginationUsers={state.availableOriginationUsers}
        availableOriginationContacts={state.availableOriginationContacts}
        isOriginationPickerOpen={state.isOriginationPickerOpen}
        originationPickerDisabled={state.originationPickerDisabled}
        originationPickerDisabledReason={state.originationPickerDisabledReason}
        onOriginationPickerOpenChange={state.handleOriginationPickerOpenChange}
        onSelectOriginationUser={state.handleSelectOriginationUser}
        onSelectOriginationContact={state.handleSelectOriginationContact}
        onClearOrigination={state.handleClearOrigination}
        closers={state.closers}
        availableCloserUsers={state.availableCloserUsers}
        availableCloserContacts={state.availableCloserContacts}
        closerShareTotal={state.closerShareTotal}
        isCloserPickerOpen={state.isCloserPickerOpen}
        closerPickerDisabled={state.closerPickerDisabled}
        closerPickerDisabledReason={state.closerPickerDisabledReason}
        closerError={state.closerError}
        commissionDirty={state.commissionDirty}
        onCloserPickerOpenChange={state.handleCloserPickerOpenChange}
        onAddCloser={state.handleAddCloser}
        onRemoveCloser={state.handleRemoveCloser}
        onCloserShareChange={state.handleCloserShareChange}
      />
      {outsiders.length > 0 ? (
        <SheetSection
          title='Access outside this company'
          description='Older access for people who aren’t at this company. Remove it, or add them on People.'
        >
          <ClientPortalAccessList
            companyId={client.company_id ?? null}
            companyPeople={[]}
            selectedContacts={outsiders}
            isPending={state.contactsAddButtonDisabled}
            pendingReason={
              state.contactsAddButtonDisabledReason ?? state.pendingReason
            }
            onGrant={state.handleAddContact}
            onRevoke={state.handleRemoveContact}
          />
        </SheetSection>
      ) : null}
      <FormFeedback>{state.feedback}</FormFeedback>
    </Form>
  )
}

/** The portal access switch for one person on the People tab, if billed. */
export function useCompanyPortalAccess() {
  const billing = useCompanyBilling()
  if (billing.status !== 'ready') return null
  const { state } = billing
  const selected = new Set(state.selectedContacts.map(contact => contact.id))
  const options = new Map(
    [...state.selectedContacts, ...state.availableContacts].map(contact => [
      contact.id,
      contact,
    ])
  )
  return function portalAccessFor(contactId: string) {
    const contact = options.get(contactId)
    if (!contact) return null
    return (
      <PortalAccessControl
        contact={contact}
        hasAccess={selected.has(contactId)}
        isPending={state.contactsAddButtonDisabled}
        pendingReason={
          state.contactsAddButtonDisabledReason ?? state.pendingReason
        }
        onGrant={state.handleAddContact}
        onRevoke={state.handleRemoveContact}
      />
    )
  }
}
