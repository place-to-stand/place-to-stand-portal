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
import { Form } from '@/components/ui/form'
import { ClientBillingFields } from '@/app/(dashboard)/companies/_components/billing/client-billing-fields'
import type { ClientRow } from '@/lib/companies/billing/client-sheet-utils'
import {
  useClientBillingForm,
  type UseClientBillingFormReturn,
} from '@/lib/companies/billing/use-client-sheet-state'
import type {
  BillingEffectiveValue,
  CompanyBillingIntent,
} from '@/lib/companies/sheet-save-schema'

/** What the company sheet's Save reads from its Billing tab. */
export type CompanyBillingHandle = {
  /**
   * The billing change for this save, or null when the tab's fields are
   * invalid (the error shows on the tab).
   */
  collect: () => CompanyBillingIntent | null
  /** "Bill this company" is on: the People tab shows portal switches. */
  billingOn: () => boolean
}

/**
 * Never billed, billed now, billed with a stop scheduled (billed through the
 * end of this month), or billed before (stopped).
 */
export type BillingMode = 'new' | 'live' | 'ending' | 'former'

type BillingContextValue = {
  /** Loading or failure of a live client's billing record. */
  status: 'loading' | 'error' | 'ready'
  mode: BillingMode
  /** "Bill this company": staged until Save. */
  billingOn: boolean
  setBillingOn: (on: boolean) => void
  /** When the staged start, stop or restart takes effect. */
  effective: BillingEffectiveValue
  setEffective: (effective: BillingEffectiveValue) => void
  /** The last month billed while a stop is scheduled. */
  billingEndsOn: string | null
  client: ClientRow | null
  state: UseClientBillingFormReturn | null
  isPending: boolean
}

const BillingContext = createContext<BillingContextValue>({
  status: 'loading',
  mode: 'new',
  billingOn: false,
  setBillingOn: () => {},
  effective: 'current_month',
  setEffective: () => {},
  billingEndsOn: null,
  client: null,
  state: null,
  isPending: false,
})

/** The company's billing state, for its Billing tab and People rows. */
export const useCompanyBilling = () => useContext(BillingContext)

type CompanyBillingProviderProps = {
  /** The company's live client (billed now), if any. */
  clientId: string | null
  /** It was billed before and isn't now (billing can restart). */
  wasClient: boolean
  /** The last month billed while a stop is scheduled. */
  billingEndsOn: string | null
  open: boolean
  isPending: boolean
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

/** Starting and restarting default to this month; stopping, to next. */
const defaultEffective = (stopping: boolean): BillingEffectiveValue =>
  stopping ? 'next_month' : 'current_month'

/**
 * A company's billing lives in its sheet: the Billing tab's "Bill this
 * company" switch, when that takes effect, and the billing fields. This
 * provider holds that state; the sheet's Save collects it (`collect`) and
 * writes it in the same transaction as the company.
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
          mode: props.billingEndsOn ? 'ending' : 'live',
          billingOn: !props.billingEndsOn,
          setBillingOn: () => {},
          effective: 'current_month',
          setEffective: () => {},
          billingEndsOn: props.billingEndsOn,
          client: null,
          state: null,
          isPending: props.isPending,
        }}
      >
        {props.children}
      </BillingContext.Provider>
    )
  }
  return (
    <BillingStateProvider
      key={client?.updated_at ?? (props.wasClient ? 'former' : 'new')}
      client={client ?? null}
      {...props}
    />
  )
}

function BillingStateProvider({
  client,
  wasClient,
  billingEndsOn,
  open,
  isPending,
  onDirtyChange,
  handleRef,
  children,
}: CompanyBillingProviderProps & { client: ClientRow | null }) {
  const mode: BillingMode = client
    ? billingEndsOn
      ? 'ending'
      : 'live'
    : wasClient
      ? 'former'
      : 'new'
  const initialOn = mode === 'live'
  const [billingOn, setBillingOnState] = useState(initialOn)
  const [effective, setEffective] = useState<BillingEffectiveValue>(
    defaultEffective(false)
  )
  // A billing form for the live client, or a blank one to start billing.
  const state = useClientBillingForm({ open, client, isPending })
  const fieldsShown = billingOn && mode !== 'former'

  const setBillingOn = useCallback(
    (on: boolean) => {
      setBillingOnState(on)
      // Switching off a live client stops it; anything else starts.
      setEffective(defaultEffective(mode === 'live' && !on))
    },
    [mode]
  )

  const dirty =
    billingOn !== initialOn || (fieldsShown && state.hasUnsavedChanges)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useImperativeHandle(
    handleRef,
    () => ({
      billingOn: () => billingOn,
      collect: () => {
        const fields = () =>
          fieldsShown && state.hasUnsavedChanges ? state.collectFields() : null
        switch (mode) {
          case 'new': {
            if (!billingOn) return { kind: 'none' }
            const start = state.collectFields()
            return start ? { kind: 'start', effective, fields: start } : null
          }
          case 'live': {
            if (!billingOn) return { kind: 'stop', effective }
            if (!state.hasUnsavedChanges) return { kind: 'none' }
            const update = state.collectFields()
            return update ? { kind: 'update', fields: update } : null
          }
          case 'ending': {
            if (!billingOn) return { kind: 'none' }
            const changed = state.hasUnsavedChanges
            const update = fields()
            if (changed && !update) return null
            // Restarting cancels the scheduled stop, whatever the month.
            return {
              kind: 'restart',
              effective: 'current_month',
              ...(update ? { fields: update } : {}),
            }
          }
          case 'former':
            return billingOn ? { kind: 'restart', effective } : { kind: 'none' }
        }
      },
    }),
    [billingOn, effective, fieldsShown, mode, state]
  )

  return (
    <BillingContext.Provider
      value={{
        status: 'ready',
        mode,
        billingOn,
        setBillingOn,
        effective,
        setEffective,
        billingEndsOn,
        client,
        state,
        isPending,
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

  return (
    <Form {...state.form}>
      <ClientBillingFields
        form={state.form}
        isPending={state.isPending}
        isEditing={mode === 'live' || mode === 'ending'}
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
    </Form>
  )
}
