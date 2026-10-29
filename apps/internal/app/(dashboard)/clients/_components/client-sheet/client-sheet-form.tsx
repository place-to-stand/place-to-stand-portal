'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { X } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetSection } from '@/components/sheets/sheet-section'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@pts/ui/input'
import {
  CompanyLinkPicker,
  useCompanyOptions,
} from '@/components/companies/company-link-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Separator } from '@pts/ui/separator'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type {
  ClientContactOption,
  CloserCandidate,
  CloserDraft,
  OriginationContactOption,
  PartnerUserOption,
  UseClientSheetStateReturn,
} from '@/lib/settings/clients/use-client-sheet-state'
import { CLIENT_BILLING_TYPE_SELECT_OPTIONS } from '@/lib/settings/clients/billing-types'
import { US_STATES } from '@/lib/settings/clients/us-states'
import { cn } from '@/lib/utils'
import type { ClientSheetFormValues } from '@/lib/settings/clients/client-sheet-schema'

import { ClientPortalAccessList } from './client-contact-picker'
import { ClientClosersEditor } from './client-closers-editor'
import { ClientEffectiveCallout } from './client-effective-callout'
import { ClientOriginationPicker } from './client-origination-picker'
import { getSubmitLabel } from '@/lib/forms/form-controls'
import { FormFeedback } from '@/components/sheets/form-feedback'
import { CompanyRecordRow } from '@/components/sheets/entity-record-rows'

const CLIENT_FORM_ID = 'client-form'

type ClientSheetFormProps = {
  form: UseFormReturn<ClientSheetFormValues>
  feedback: string | null
  isPending: boolean
  isEditing: boolean
  /** The saved billing type — reveals the boundary select when it differs. */
  initialBillingType: string | null
  pendingReason: string
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  onSubmit: UseClientSheetStateReturn['handleFormSubmit']
  onRequestDelete: () => void
  isSheetOpen: boolean
  historyKey: string
  // Contacts
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

export function ClientSheetForm({
  form,
  feedback,
  isPending,
  isEditing,
  initialBillingType,
  pendingReason,
  submitDisabled,
  submitDisabledReason,
  deleteDisabled,
  deleteDisabledReason,
  onSubmit,
  onRequestDelete,
  isSheetOpen,
  historyKey,
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
}: ClientSheetFormProps) {
  // Subscribed value (not form.watch in JSX — that read proved unreliable
  // across the form-prop boundary): drives the boundary-select visibility.
  const watchedBillingType = useWatch({
    control: form.control,
    name: 'billingType',
  })
  // Portal access lists this company's people first.
  const selectedCompanyId =
    useWatch({ control: form.control, name: 'companyId' }) || null
  const { data: companyOptions = [] } = useCompanyOptions()
  const linkedCompany = selectedCompanyId
    ? (companyOptions.find(option => option.id === selectedCompanyId) ?? null)
    : null
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
  // The company saved on the client, so an unlink can be shown and undone.
  const savedCompanyId = form.formState.defaultValues?.companyId ?? ''
  const savedCompany = savedCompanyId
    ? (companyOptions.find(option => option.id === savedCompanyId) ?? null)
    : null

  const handleSave = useCallback(
    () => form.handleSubmit(onSubmit)(),
    [form, onSubmit]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: isSheetOpen,
    canSave: !submitDisabled,
    onSave: handleSave,
    historyKey,
  })

  const saveLabel = useMemo(
    () =>
      getSubmitLabel({
        isSaving: isPending,
        isEditing,
        createLabel: 'Create client',
      }),
    [isEditing, isPending]
  )

  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSheetOpen && firstFieldRef.current) {
      // Small delay to ensure sheet animation completes
      const timeoutId = setTimeout(() => {
        firstFieldRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isSheetOpen])

  const fieldDisabledReason = isPending ? pendingReason : null

  return (
    <Form {...form}>
      <div className='flex-1 overflow-y-auto'>
        <form
          id={CLIENT_FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-col gap-6 px-6 pt-6 pb-8'
        >
          <SheetSection title='Details'>
            <FormField
              control={form.control}
              name='companyId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked company</FormLabel>
                  {isEditing && field.value && linkedCompany ? (
                    <CompanyRecordRow
                      company={linkedCompany}
                      linked
                      note={
                        field.value !== savedCompanyId ? (
                          <span className='text-warning'>Links on save</span>
                        ) : undefined
                      }
                      actions={
                        <RowActionButton
                          type='button'
                          label='Unlink company'
                          disabled={isPending}
                          onClick={() => field.onChange('')}
                          className='text-muted-foreground hover:text-destructive'
                          icon={<X />}
                        />
                      }
                    />
                  ) : isEditing && !field.value && savedCompany ? (
                    // Staged: unlinks on Save. Portal access is kept, and
                    // the list below flags who isn't at a linked company.
                    <CompanyRecordRow
                      company={savedCompany}
                      className='opacity-60'
                      note={
                        <span className='text-destructive'>
                          Unlinks on save · portal access is kept
                        </span>
                      }
                      actions={
                        <Button
                          type='button'
                          variant='ghost'
                          size='xs'
                          className='text-muted-foreground'
                          disabled={isPending}
                          onClick={() => field.onChange(savedCompanyId)}
                          aria-label={`Undo unlinking ${savedCompany.name}`}
                        >
                          Undo
                        </Button>
                      }
                    />
                  ) : (
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={fieldDisabledReason}
                      >
                        <CompanyLinkPicker
                          value={
                            field.value ? { id: field.value, name: '' } : null
                          }
                          onChange={next => field.onChange(next?.id ?? '')}
                          disabled={isPending}
                          placeholder='Link company'
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                  )}
                  <p className='text-muted-foreground text-xs'>
                    A company has one client. The client takes the company’s
                    name and uses its primary contact.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEditing ? (
              <FormField
                control={form.control}
                name='slug'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={fieldDisabledReason}
                      >
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder='acme'
                          disabled={isPending}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </SheetSection>

          <Separator />

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

          <FormFeedback>{feedback}</FormFeedback>
        </form>
      </div>
      <SheetFormFooter
        formId={CLIENT_FORM_ID}
        saveLabel={saveLabel}
        submitDisabled={submitDisabled}
        submitDisabledReason={submitDisabledReason}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isEditing={isEditing}
        deleteDisabled={deleteDisabled}
        deleteDisabledReason={deleteDisabledReason}
        onRequestDelete={onRequestDelete}
        deleteAriaLabel='Archive client'
      />
    </Form>
  )
}
