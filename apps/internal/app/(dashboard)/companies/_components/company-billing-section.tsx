'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import { Skeleton } from '@pts/ui/skeleton'
import { FormFeedback } from '@/components/sheets/form-feedback'
import { SheetSection } from '@/components/sheets/sheet-section'
import { Form } from '@/components/ui/form'
import { ClientBillingFields } from '@/app/(dashboard)/companies/_components/billing/client-billing-fields'
import {
  PortalAccessOutsiders,
  PortalAccessControl,
} from '@/app/(dashboard)/companies/_components/billing/client-contact-picker'
import { useToast } from '@/components/ui/use-toast'
import {
  restoreClient,
  softDeleteClient,
} from '@/app/(dashboard)/companies/billing-actions'
import type { ClientRow } from '@/lib/companies/billing/client-sheet-utils'
import {
  useClientSheetState,
  type UseClientSheetStateReturn,
} from '@/lib/companies/billing/use-client-sheet-state'

/** What the company sheet needs from its client's billing form. */
export type CompanyBillingHandle = {
  /** Billing, commission or portal access has unsaved edits. */
  isDirty: () => boolean
  /** Saves the billing edits; `onSaved` fires when done. */
  submit: () => void
}

/** Never billed, billed now, or billed before (stopped). */
type BillingMode = 'new' | 'live' | 'former'

type BillingContextValue = {
  /** Loading or failure of a live client's billing record. */
  status: 'none' | 'loading' | 'error' | 'ready'
  mode: BillingMode
  /** "Bill this company": staged until Save. */
  billingOn: boolean
  setBillingOn: (on: boolean) => void
  client: ClientRow | null
  state: UseClientSheetStateReturn | null
}

const BillingContext = createContext<BillingContextValue>({
  status: 'none',
  mode: 'new',
  billingOn: false,
  setBillingOn: () => {},
  client: null,
  state: null,
})

/** The company's billing state, for its Billing tab and People rows. */
export const useCompanyBilling = () => useContext(BillingContext)

type CompanyBillingProviderProps = {
  companyId: string
  /** The company's live client, if billed now. */
  clientId: string | null
  /** Its stopped client, if billed before and not now. */
  formerClientId: string | null
  open: boolean
  /** Fires after a billing save. */
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
 * A company's billing lives in its sheet: the Billing tab's "Bill this
 * company" switch and fields, and the People rows' portal switches. One
 * provider holds that state and the company's Save saves it: switching
 * billing on makes the company a client (or restarts it), switching it off
 * stops billing.
 */
export function CompanyBillingProvider(props: CompanyBillingProviderProps) {
  const { clientId } = props
  const { data: client, isError } = useQuery({
    queryKey: ['clientBilling', clientId],
    queryFn: () => fetchClientBilling(clientId!),
    enabled: Boolean(clientId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  if (clientId && !client) {
    return (
      <BillingContext.Provider
        value={{
          status: isError ? 'error' : 'loading',
          mode: 'live',
          billingOn: true,
          setBillingOn: () => {},
          client: null,
          state: null,
        }}
      >
        {props.children}
      </BillingContext.Provider>
    )
  }
  return (
    <BillingStateProvider
      key={client?.updated_at ?? props.formerClientId ?? 'new'}
      client={client ?? null}
      {...props}
    />
  )
}

function BillingStateProvider({
  companyId,
  client,
  formerClientId,
  open,
  onSaved,
  onDirtyChange,
  handleRef,
  children,
}: CompanyBillingProviderProps & { client: ClientRow | null }) {
  const { toast } = useToast()
  const mode: BillingMode = client ? 'live' : formerClientId ? 'former' : 'new'
  const initialOn = mode === 'live'
  const [billingOn, setBillingOn] = useState(initialOn)
  // A billing form for the live client, or a blank one to make it a client.
  const state = useClientSheetState({
    open,
    onOpenChange: () => {},
    onComplete: onSaved,
    client,
    initialCompanyId: client ? undefined : companyId,
    quietSuccess: true,
  })

  const dirty =
    billingOn !== initialOn ||
    (billingOn && mode !== 'former' && state.hasUnsavedChanges)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const run = useCallback(
    async (action: () => Promise<{ error?: string | null }>) => {
      const result = await action()
      if (result.error) {
        toast({
          title: 'Billing not saved',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      onSaved()
    },
    [onSaved, toast]
  )

  useImperativeHandle(
    handleRef,
    () => ({
      isDirty: () => dirty,
      submit: () => {
        if (mode === 'live' && !billingOn && client) {
          void run(() => softDeleteClient({ id: client.id }))
        } else if (mode === 'former' && billingOn && formerClientId) {
          void run(() => restoreClient({ id: formerClientId }))
        } else if (billingOn && mode !== 'former') {
          void state.form.handleSubmit(state.handleFormSubmit)()
        } else {
          onSaved()
        }
      },
    }),
    [billingOn, client, dirty, formerClientId, mode, onSaved, run, state]
  )

  return (
    <BillingContext.Provider
      value={{
        status: 'ready',
        mode,
        billingOn,
        setBillingOn,
        client,
        state,
      }}
    >
      {children}
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
  if (billing.status !== 'ready' || !billing.state) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    )
  }

  const { client, state, mode } = billing
  const companyIds = new Set(
    [...state.selectedContacts, ...state.availableContacts]
      .filter(contact => contact.companyId === client?.company_id)
      .map(contact => contact.id)
  )
  // Older access for people not at the company (a live client only).
  const outsiders = client
    ? state.selectedContacts.filter(contact => !companyIds.has(contact.id))
    : []

  return (
    <Form {...state.form}>
      <ClientBillingFields
        form={state.form}
        isPending={state.isPending}
        isEditing={mode === 'live'}
        initialBillingType={client?.billing_type ?? null}
        pendingReason={state.pendingReason}
        onCreateOriginationContact={state.handleCreateOriginationContact}
        onCreateCloserContact={state.handleCreateCloserContact}
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
          <PortalAccessOutsiders
            people={outsiders}
            isPending={state.contactsAddButtonDisabled}
            pendingReason={
              state.contactsAddButtonDisabledReason ?? state.pendingReason
            }
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
  if (billing.status !== 'ready' || billing.mode !== 'live' || !billing.state)
    return null
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
