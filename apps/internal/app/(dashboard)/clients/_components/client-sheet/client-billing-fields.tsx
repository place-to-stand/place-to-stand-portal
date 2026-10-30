'use client'

import { useMemo } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { Badge } from '@pts/ui/badge'
import { Separator } from '@pts/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { SheetSection } from '@/components/sheets/sheet-section'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type {
  ClientContactOption,
  CloserCandidate,
  CloserDraft,
  OriginationContactOption,
  PartnerUserOption,
} from '@/lib/settings/clients/use-client-sheet-state'
import { CLIENT_BILLING_TYPE_SELECT_OPTIONS } from '@/lib/settings/clients/billing-types'
import { US_STATES } from '@/lib/settings/clients/us-states'
import type { ClientSheetFormValues } from '@/lib/settings/clients/client-sheet-schema'
import { cn } from '@/lib/utils'

import { ClientPortalAccessList } from './client-contact-picker'
import { ClientClosersEditor } from './client-closers-editor'
import { ClientEffectiveCallout } from './client-effective-callout'
import { ClientOriginationPicker } from './client-origination-picker'

export type ClientBillingFieldsProps = {
  form: UseFormReturn<ClientSheetFormValues>
  isPending: boolean
  isEditing: boolean
  /** The saved billing type — reveals the boundary select when it differs. */
  initialBillingType: string | null
  pendingReason: string
  // Portal access
  selectedContacts: ClientContactOption[]
  availableContacts: ClientContactOption[]
  contactsAddButtonDisabled: boolean
  contactsAddButtonDisabledReason: string | null
  onAddContact: (contact: ClientContactOption) => void
  onCreateOriginationContact: (query: string) => void
  onCreateCloserContact: (query: string) => void
  onRemoveContact: (contact: ClientContactOption) => void
  // Origination
  selectedOriginationUser: PartnerUserOption | null
  selectedOriginationContact: OriginationContactOption | null
  availableOriginationUsers: PartnerUserOption[]
  availableOriginationContacts: OriginationContactOption[]
  isOriginationPickerOpen: boolean
  originationPickerDisabled: boolean
  originationPickerDisabledReason: string | null
  onOriginationPickerOpenChange: (open: boolean) => void
  onSelectOriginationUser: (user: PartnerUserOption) => void
  onSelectOriginationContact: (contact: OriginationContactOption) => void
  onClearOrigination: () => void
  // Closers
  closers: CloserDraft[]
  availableCloserUsers: CloserCandidate[]
  availableCloserContacts: CloserCandidate[]
  closerShareTotal: number | null
  isCloserPickerOpen: boolean
  closerPickerDisabled: boolean
  closerPickerDisabledReason: string | null
  closerError: string | null
  /** Closers or origination differ from the saved assignment — reveals the boundary select. */
  commissionDirty: boolean
  onCloserPickerOpenChange: (open: boolean) => void
  onAddCloser: (candidate: CloserCandidate) => void
  onRemoveCloser: (key: string) => void
  onCloserShareChange: (key: string, shareText: string) => void
}

/**
 * A client's billing: billing type and state, commission, and portal access.
 * Shown in the company sheet (a client is its company's billing record) and
 * in the Make client sheet. Renders inside the caller's `<Form>`.
 */
export function ClientBillingFields({
  form,
  isPending,
  isEditing,
  initialBillingType,
  pendingReason,
  selectedContacts,
  availableContacts,
  contactsAddButtonDisabled,
  contactsAddButtonDisabledReason,
  onAddContact,
  onCreateOriginationContact,
  onCreateCloserContact,
  onRemoveContact,
  selectedOriginationUser,
  selectedOriginationContact,
  availableOriginationUsers,
  availableOriginationContacts,
  isOriginationPickerOpen,
  originationPickerDisabled,
  originationPickerDisabledReason,
  onOriginationPickerOpenChange,
  onSelectOriginationUser,
  onSelectOriginationContact,
  onClearOrigination,
  closers,
  availableCloserUsers,
  availableCloserContacts,
  closerShareTotal,
  isCloserPickerOpen,
  closerPickerDisabled,
  closerPickerDisabledReason,
  closerError,
  commissionDirty,
  onCloserPickerOpenChange,
  onAddCloser,
  onRemoveCloser,
  onCloserShareChange,
}: ClientBillingFieldsProps) {
  // Subscribed value (not form.watch in JSX — that read proved unreliable
  // across the form-prop boundary): drives the boundary-select visibility.
  const watchedBillingType = useWatch({
    control: form.control,
    name: 'billingType',
  })
  const selectedCompanyId =
    useWatch({ control: form.control, name: 'companyId' }) || null
  // Portal access lists everyone at the company, by name.
  const companyPeople = useMemo(
    () =>
      selectedCompanyId
        ? [...selectedContacts, ...availableContacts]
            .filter(contact => contact.companyId === selectedCompanyId)
            .sort((a, b) =>
              (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? '')
            )
        : [],
    [availableContacts, selectedCompanyId, selectedContacts]
  )
  const fieldDisabledReason = isPending ? pendingReason : null

  return (
    <>
      <SheetSection title='Billing'>
        <div className='grid grid-cols-1 items-start gap-4 sm:grid-cols-2'>
          <FormField
            control={form.control}
            name='billingType'
            render={({ field }) => {
              const selectedBillingType =
                CLIENT_BILLING_TYPE_SELECT_OPTIONS.find(
                  option => option.value === field.value
                ) ?? CLIENT_BILLING_TYPE_SELECT_OPTIONS[0]

              return (
                <FormItem>
                  <FormLabel>Billing type</FormLabel>
                  <Select
                    value={field.value ?? selectedBillingType.value}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={fieldDisabledReason}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select billing type'>
                            <Badge
                              variant='outline'
                              className={cn(
                                'text-xs',
                                selectedBillingType.badgeClassName
                              )}
                            >
                              {selectedBillingType.label}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                      </DisabledFieldTooltip>
                    </FormControl>
                    <SelectContent>
                      {CLIENT_BILLING_TYPE_SELECT_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <Badge
                            variant='outline'
                            className={cn('text-xs', option.badgeClassName)}
                          >
                            {option.label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBillingType.description ? (
                    <FormDescription>
                      {selectedBillingType.description}
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name='state'
            render={({ field }) => (
              <FormItem>
                <FormLabel optional>State</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={value => {
                    field.onChange(value === '' ? '' : value)
                  }}
                  disabled={isPending}
                >
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={isPending}
                      reason={fieldDisabledReason}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select state' />
                      </SelectTrigger>
                    </DisabledFieldTooltip>
                  </FormControl>
                  <SelectContent>
                    {US_STATES.map(state => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label} ({state.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Sets the tax rate on invoices.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {isEditing &&
        initialBillingType !== null &&
        watchedBillingType !== initialBillingType ? (
          <ClientEffectiveCallout
            form={form}
            name='billingEffective'
            title='New billing type starts'
            notes={{
              current_month:
                "This month's close re-derives under the new billing type.",
              next_month:
                'Invoices use the new type right away; the Monthly Close switches this client at the boundary.',
            }}
            isPending={isPending}
            pendingReason={pendingReason}
          />
        ) : null}
      </SheetSection>

      <Separator />

      <SheetSection
        title='Commission'
        description='Origination pays 10% and closers share 20% of this client’s revenue.'
      >
        <div className='grid gap-2'>
          <FormLabel optional>Origination</FormLabel>
          <ClientOriginationPicker
            selectedUser={selectedOriginationUser}
            selectedContact={selectedOriginationContact}
            availableUsers={availableOriginationUsers}
            availableContacts={availableOriginationContacts}
            disabled={originationPickerDisabled}
            disabledReason={originationPickerDisabledReason}
            isPickerOpen={isOriginationPickerOpen}
            isPending={isPending}
            pendingReason={pendingReason}
            onPickerOpenChange={onOriginationPickerOpenChange}
            onSelectUser={onSelectOriginationUser}
            onSelectContact={onSelectOriginationContact}
            onClear={onClearOrigination}
            onCreateContact={onCreateOriginationContact}
          />
        </div>
        <div className='grid gap-2'>
          <FormLabel
            optional
            data-error={Boolean(closerError)}
            className='data-[error=true]:text-destructive'
          >
            {closers.length > 1 ? 'Closers' : 'Closer'}
          </FormLabel>
          <ClientClosersEditor
            closers={closers}
            availableUsers={availableCloserUsers}
            availableContacts={availableCloserContacts}
            shareTotal={closerShareTotal}
            hasError={Boolean(closerError)}
            disabled={closerPickerDisabled}
            disabledReason={closerPickerDisabledReason}
            isPickerOpen={isCloserPickerOpen}
            isPending={isPending}
            pendingReason={pendingReason}
            onPickerOpenChange={onCloserPickerOpenChange}
            onAdd={onAddCloser}
            onRemove={onRemoveCloser}
            onShareChange={onCloserShareChange}
            onCreateContact={onCreateCloserContact}
          />
          {closerError ? (
            <p className='text-destructive text-xs'>{closerError}</p>
          ) : null}
        </div>
        {isEditing && commissionDirty ? (
          <ClientEffectiveCallout
            form={form}
            name='commissionEffective'
            title='New assignment starts'
            notes={{
              current_month:
                "This month's close pays commissions under the new assignment.",
              next_month:
                'Earlier months keep paying the previous closers and originator.',
            }}
            isPending={isPending}
            pendingReason={pendingReason}
          />
        ) : null}
      </SheetSection>

      <Separator />

      <SheetSection
        title='Portal access'
        description='Which of the company’s contacts can see this client in the client portal. Contacts and the primary contact are managed on the company.'
      >
        <ClientPortalAccessList
          companyId={selectedCompanyId}
          companyPeople={companyPeople}
          selectedContacts={selectedContacts}
          // Locked while saving or while the access list loads.
          isPending={contactsAddButtonDisabled}
          pendingReason={contactsAddButtonDisabledReason ?? pendingReason}
          onGrant={onAddContact}
          onRevoke={onRemoveContact}
        />
      </SheetSection>
    </>
  )
}
