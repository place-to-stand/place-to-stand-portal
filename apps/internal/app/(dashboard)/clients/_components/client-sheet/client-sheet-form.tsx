'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { Archive, Redo2, Undo2 } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type {
  ClientContactOption,
  OriginationContactOption,
  OriginationMode,
  PartnerUserOption,
  UseClientSheetStateReturn,
} from '@/lib/settings/clients/use-client-sheet-state'
import { CLIENT_BILLING_TYPE_SELECT_OPTIONS } from '@/lib/settings/clients/billing-types'
import { US_STATES } from '@/lib/settings/clients/us-states'
import { cn } from '@/lib/utils'
import type { ClientSheetFormValues } from '@/lib/settings/clients/client-sheet-schema'

import { ClientContactPicker } from './client-contact-picker'
import { ClientCloserPicker } from './client-closer-picker'
import { ClientOriginationPicker } from './client-origination-picker'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

type ClientSheetFormProps = {
  form: UseFormReturn<ClientSheetFormValues>
  feedback: string | null
  isPending: boolean
  isEditing: boolean
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
  isContactPickerOpen: boolean
  onContactPickerOpenChange: (open: boolean) => void
  onAddContact: (contact: ClientContactOption) => void
  onRemoveContact: (contact: ClientContactOption) => void
  // Origination
  originationMode: OriginationMode
  selectedOriginationUser: PartnerUserOption | null
  selectedOriginationContact: OriginationContactOption | null
  availableOriginationUsers: PartnerUserOption[]
  availableOriginationContacts: OriginationContactOption[]
  isOriginationUserPickerOpen: boolean
  isOriginationContactPickerOpen: boolean
  originationPickerDisabled: boolean
  originationPickerDisabledReason: string | null
  originationError: string | null
  onOriginationModeChange: (mode: OriginationMode) => void
  onOriginationUserPickerOpenChange: (open: boolean) => void
  onOriginationContactPickerOpenChange: (open: boolean) => void
  onSelectOriginationUser: (user: PartnerUserOption) => void
  onSelectOriginationContact: (contact: OriginationContactOption) => void
  onClearOrigination: () => void
  // Closer
  selectedCloser: PartnerUserOption | null
  availableClosers: PartnerUserOption[]
  isCloserPickerOpen: boolean
  closerPickerDisabled: boolean
  closerPickerDisabledReason: string | null
  closerError: string | null
  onCloserPickerOpenChange: (open: boolean) => void
  onSelectCloser: (user: PartnerUserOption) => void
  onClearCloser: () => void
}

export function ClientSheetForm({
  form,
  feedback,
  isPending,
  isEditing,
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
  isContactPickerOpen,
  onContactPickerOpenChange,
  onAddContact,
  onRemoveContact,
  originationMode,
  selectedOriginationUser,
  selectedOriginationContact,
  availableOriginationUsers,
  availableOriginationContacts,
  isOriginationUserPickerOpen,
  isOriginationContactPickerOpen,
  originationPickerDisabled,
  originationPickerDisabledReason,
  originationError,
  onOriginationModeChange,
  onOriginationUserPickerOpenChange,
  onOriginationContactPickerOpenChange,
  onSelectOriginationUser,
  onSelectOriginationContact,
  onClearOrigination,
  selectedCloser,
  availableClosers,
  isCloserPickerOpen,
  closerPickerDisabled,
  closerPickerDisabledReason,
  closerError,
  onCloserPickerOpenChange,
  onSelectCloser,
  onClearCloser,
}: ClientSheetFormProps) {
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

  const saveLabel = useMemo(() => {
    if (isPending) {
      return 'Saving...'
    }

    return isEditing ? 'Save changes' : 'Create client'
  }, [isEditing, isPending])

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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-1 flex-col gap-5 px-6 pb-32'
      >
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                >
                  <Input
                    {...field}
                    ref={node => {
                      firstFieldRef.current = node
                      if (typeof field.ref === 'function') {
                        field.ref(node)
                      } else if (field.ref) {
                        ;(
                          field.ref as React.MutableRefObject<HTMLInputElement | null>
                        ).current = node
                      }
                    }}
                    placeholder='Acme Corp'
                    disabled={isPending}
                  />
                </DisabledFieldTooltip>
              </FormControl>
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
                    reason={isPending ? pendingReason : null}
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
                <FormLabel>Billing Type</FormLabel>
                <Select
                  value={field.value ?? selectedBillingType.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={isPending}
                      reason={isPending ? pendingReason : null}
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
                  <SelectContent align='start'>
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
              <FormLabel>State (optional)</FormLabel>
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
                    reason={isPending ? pendingReason : null}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select state (optional)' />
                    </SelectTrigger>
                  </DisabledFieldTooltip>
                </FormControl>
                <SelectContent align='start'>
                  {US_STATES.map(state => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label} ({state.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Used to calculate tax rate on invoices.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='website'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website (optional)</FormLabel>
              <FormControl>
                <DisabledFieldTooltip
                  disabled={isPending}
                  reason={isPending ? pendingReason : null}
                >
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder='https://example.com'
                    disabled={isPending}
                  />
                </DisabledFieldTooltip>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='grid gap-2'>
          <FormLabel
            data-error={Boolean(originationError)}
            className='data-[error=true]:text-destructive'
          >
            Origination
          </FormLabel>
          <ClientOriginationPicker
            mode={originationMode}
            selectedUser={selectedOriginationUser}
            selectedContact={selectedOriginationContact}
            availableUsers={availableOriginationUsers}
            availableContacts={availableOriginationContacts}
            disabled={originationPickerDisabled}
            disabledReason={originationPickerDisabledReason}
            isUserPickerOpen={isOriginationUserPickerOpen}
            isContactPickerOpen={isOriginationContactPickerOpen}
            isPending={isPending}
            pendingReason={pendingReason}
            onModeChange={onOriginationModeChange}
            onUserPickerOpenChange={onOriginationUserPickerOpenChange}
            onContactPickerOpenChange={onOriginationContactPickerOpenChange}
            onSelectUser={onSelectOriginationUser}
            onSelectContact={onSelectOriginationContact}
            onClear={onClearOrigination}
          />
          {originationError ? (
            <p className='text-destructive text-xs'>{originationError}</p>
          ) : null}
        </div>
        <div className='grid gap-2'>
          <FormLabel
            data-error={Boolean(closerError)}
            className='data-[error=true]:text-destructive'
          >
            Closer
          </FormLabel>
          <ClientCloserPicker
            selectedCloser={selectedCloser}
            availableClosers={availableClosers}
            disabled={closerPickerDisabled}
            disabledReason={closerPickerDisabledReason}
            isPickerOpen={isCloserPickerOpen}
            isPending={isPending}
            pendingReason={pendingReason}
            onPickerOpenChange={onCloserPickerOpenChange}
            onSelect={onSelectCloser}
            onClear={onClearCloser}
          />
          {closerError ? (
            <p className='text-destructive text-xs'>{closerError}</p>
          ) : null}
        </div>
        <div className='space-y-2'>
          <FormLabel>Contacts</FormLabel>
          <ClientContactPicker
            selectedContacts={selectedContacts}
            availableContacts={availableContacts}
            addButtonDisabled={contactsAddButtonDisabled}
            addButtonDisabledReason={contactsAddButtonDisabledReason}
            isPickerOpen={isContactPickerOpen}
            isPending={isPending}
            pendingReason={pendingReason}
            onPickerOpenChange={onContactPickerOpenChange}
            onAddContact={onAddContact}
            onRequestRemoval={onRemoveContact}
          />
        </div>
        {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
        <div className='border-border/40 bg-muted/95 supports-backdrop-filter:bg-muted/90 fixed right-0 bottom-0 z-50 w-full border-t shadow-lg backdrop-blur sm:max-w-lg'>
          <div className='flex w-full items-center justify-between gap-3 px-6 py-4'>
            <div className='flex items-center gap-2'>
              <DisabledFieldTooltip
                disabled={submitDisabled}
                reason={submitDisabledReason}
              >
                <Button
                  type='submit'
                  disabled={submitDisabled}
                  aria-label={`${saveLabel} (⌘S / Ctrl+S)`}
                  title={`${saveLabel} (⌘S / Ctrl+S)`}
                >
                  {saveLabel}
                </Button>
              </DisabledFieldTooltip>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={undo}
                disabled={!canUndo}
                aria-label='Undo (⌘Z / Ctrl+Z)'
                title='Undo (⌘Z / Ctrl+Z)'
              >
                <Undo2 className='h-4 w-4' />
              </Button>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={redo}
                disabled={!canRedo}
                aria-label='Redo (⇧⌘Z / Ctrl+Shift+Z)'
                title='Redo (⇧⌘Z / Ctrl+Shift+Z)'
              >
                <Redo2 className='h-4 w-4' />
              </Button>
            </div>
            {isEditing ? (
              <DisabledFieldTooltip
                disabled={deleteDisabled}
                reason={deleteDisabledReason}
              >
                <Button
                  type='button'
                  variant='destructive'
                  onClick={onRequestDelete}
                  disabled={deleteDisabled}
                  aria-label='Archive client'
                  title='Archive client'
                  size='icon'
                >
                  <Archive className='h-4 w-4' />
                </Button>
              </DisabledFieldTooltip>
            ) : null}
          </div>
        </div>
      </form>
    </Form>
  )
}
