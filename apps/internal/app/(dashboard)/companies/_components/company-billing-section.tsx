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
import type { ClientWithClosers } from '@/lib/companies/billing/client-sheet-utils'
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
  /**
   * The People tab shows portal switches: "Bill this company" is on, or it
   * is a former client (its switches show as they are).
   */
  portalShown: () => boolean
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
  /** In the final billed month: "Keep billing" cancels the stop on Save. */
  keepBilling: boolean
  setKeepBilling: (keep: boolean) => void
  client: ClientWithClosers | null
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
  keepBilling: false,
  setKeepBilling: () => {},
  client: null,
  state: null,
  isPending: false,
})

/** The company's billing state, for its Billing tab and People rows. */
export const useCompanyBilling = () => useContext(BillingContext)

type CompanyBillingProviderProps = {
  /**
   * The company, when it is billed now or was billed before: its billing
   * terms load into the form (a former client's last terms, to restart
   * with). Null for a company never billed.
   */
  companyId: string | null
  /** Billed now (a stop may be scheduled). */
  billed: boolean
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

async function fetchClientBilling(
  companyId: string
): Promise<ClientWithClosers> {
  const response = await fetch(
    `/api/sheets/init?entity=client&id=${encodeURIComponent(companyId)}`
  )
  const result = (await response.json()) as
    | { ok: true; data: { client: ClientWithClosers | null } }
    | { ok: false; error?: string }
  if (!result.ok || !result.data.client) {
    throw new Error(result.ok ? 'Client not found' : result.error)
  }
  return result.data.client
}

/** Starting and restarting default to this month; stopping, to next. */
const defaultEffective = (stopping: boolean): BillingEffectiveValue =>
  stopping ? 'next_month' : 'current_month'

const billingModeOf = (props: {
  billed: boolean
  billingEndsOn: string | null
  wasClient: boolean
}): BillingMode =>
  props.billed
    ? props.billingEndsOn
      ? 'ending'
      : 'live'
    : props.wasClient
      ? 'former'
      : 'new'

/**
 * A company's billing lives in its sheet: the Billing tab's "Bill this
 * company" switch, when that takes effect, and the billing fields. This
 * provider holds that state; the sheet's Save collects it (`collect`) and
 * writes it in the same transaction as the company.
 */
export function CompanyBillingProvider(props: CompanyBillingProviderProps) {
  const { companyId } = props
  const { data: client, isError } = useQuery({
    queryKey: ['clientBilling', companyId],
    queryFn: () => fetchClientBilling(companyId!),
    enabled: Boolean(companyId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  if (companyId && !client) {
    const mode = billingModeOf(props)
    return (
      <BillingContext.Provider
        value={{
          status: isError ? 'error' : 'loading',
          mode,
          billingOn: mode === 'live' || mode === 'ending',
          setBillingOn: () => {},
          effective: 'current_month',
          setEffective: () => {},
          billingEndsOn: props.billingEndsOn,
          keepBilling: false,
          setKeepBilling: () => {},
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
  billed,
  wasClient,
  billingEndsOn,
  open,
  isPending,
  onDirtyChange,
  handleRef,
  children,
}: CompanyBillingProviderProps & { client: ClientWithClosers | null }) {
  const mode = billingModeOf({ billed, billingEndsOn, wasClient })
  // Billed now, the final billed month included: the switch starts on.
  const billedNow = mode === 'live' || mode === 'ending'
  const initialOn = billedNow
  const [billingOn, setBillingOnState] = useState(initialOn)
  const [keepBilling, setKeepBilling] = useState(false)
  const [effective, setEffective] = useState<BillingEffectiveValue>(
    defaultEffective(false)
  )
  // A billing form seeded with the client's terms (a former client's last
  // ones, to restart with), or a blank one to start billing.
  const state = useClientBillingForm({ open, client, isPending })
  const fieldsShown = billingOn

  const setBillingOn = useCallback(
    (on: boolean) => {
      setBillingOnState(on)
      if (!on) setKeepBilling(false)
      // Switching off a client billed now stops it; anything else starts.
      setEffective(defaultEffective(billedNow && !on))
    },
    [billedNow]
  )

  const dirty =
    billingOn !== initialOn ||
    keepBilling ||
    (fieldsShown && state.hasUnsavedChanges)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useImperativeHandle(
    handleRef,
    () => ({
      portalShown: () => billingOn || mode === 'former',
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
            // Switched off: "this month" as the last month billed is the
            // stop already scheduled; "last month" moves it earlier.
            if (!billingOn) {
              return effective === 'current_month'
                ? { kind: 'stop', effective }
                : { kind: 'none' }
            }
            const changed = state.hasUnsavedChanges
            const update = fields()
            if (changed && !update) return null
            if (keepBilling) {
              // Cancels the scheduled stop, whatever the month.
              return {
                kind: 'restart',
                effective: 'current_month',
                ...(update ? { fields: update } : {}),
              }
            }
            // Terms stay editable while the stop is scheduled.
            return update
              ? { kind: 'update', fields: update }
              : { kind: 'none' }
          }
          case 'former': {
            if (!billingOn) return { kind: 'none' }
            // Edited terms save with the restart, from its first month.
            const changed = state.hasUnsavedChanges
            const update = fields()
            if (changed && !update) return null
            return {
              kind: 'restart',
              effective,
              ...(update ? { fields: update } : {}),
            }
          }
        }
      },
    }),
    [billingOn, effective, fieldsShown, keepBilling, mode, state]
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
        keepBilling,
        setKeepBilling,
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
