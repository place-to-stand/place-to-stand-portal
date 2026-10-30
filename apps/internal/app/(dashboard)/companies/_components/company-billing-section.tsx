'use client'

import { useEffect, useImperativeHandle, type Ref } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Skeleton } from '@pts/ui/skeleton'
import { FormFeedback } from '@/components/sheets/form-feedback'
import { Form } from '@/components/ui/form'
import { ClientBillingFields } from '@/app/(dashboard)/clients/_components/client-sheet/client-billing-fields'
import {
  ARCHIVE_CLIENT_CONFIRM_LABEL,
  ARCHIVE_CLIENT_DIALOG_TITLE,
  getArchiveClientDialogDescription,
} from '@/lib/settings/clients/client-sheet-constants'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'
import { useClientSheetState } from '@/lib/settings/clients/use-client-sheet-state'

/** What the company sheet needs from its Billing section. */
export type CompanyBillingHandle = {
  /** Billing, commission or portal access has unsaved edits. */
  isDirty: () => boolean
  /** Saves the billing edits; `onSaved` fires when done. */
  submit: () => void
  /** Asks to archive the client (stop billing). */
  requestStopBilling: () => void
}

type CompanyBillingSectionProps = {
  clientId: string
  open: boolean
  /** Fires after a billing save or after billing stops. */
  onSaved: () => void
  /** Keeps the company sheet's unsaved-changes guard in step. */
  onDirtyChange: (dirty: boolean) => void
  handleRef: Ref<CompanyBillingHandle>
}

const clientBillingQueryKey = (clientId: string) => ['clientBilling', clientId]

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
 * A client company's billing (admins only): billing type, state, commission
 * and portal access. A client is its company's billing record, so it is
 * edited here and saved with the company's Save.
 */
export function CompanyBillingSection(props: CompanyBillingSectionProps) {
  const { data: client, isError } = useQuery({
    queryKey: clientBillingQueryKey(props.clientId),
    queryFn: () => fetchClientBilling(props.clientId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  if (isError) {
    return (
      <p className='text-muted-foreground text-sm'>
        Billing could not be loaded. Reload to try again.
      </p>
    )
  }
  if (!client) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    )
  }
  return <CompanyBillingForm key={client.updated_at} client={client} {...props} />
}

function CompanyBillingForm({
  client,
  open,
  onSaved,
  onDirtyChange,
  handleRef,
}: CompanyBillingSectionProps & { client: ClientRow }) {
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
    <Form {...state.form}>
      <ClientBillingFields
        form={state.form}
        isPending={state.isPending}
        isEditing
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
      <FormFeedback>{state.feedback}</FormFeedback>
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
    </Form>
  )
}
