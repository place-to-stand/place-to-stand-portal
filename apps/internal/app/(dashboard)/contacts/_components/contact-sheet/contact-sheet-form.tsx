'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { User2, UserPlus } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetSection } from '@/components/sheets/sheet-section'
import { LinkedRecordCard } from '@/components/sheets/linked-record-card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@pts/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Separator } from '@pts/ui/separator'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'

import {
  ContactClientLinkButton,
  ContactClientList,
  type ContactClientOption,
} from './contact-client-picker'
import { ContactPortalAccountCard } from './contact-portal-account-card'

const FEEDBACK_CLASSES =
  'border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm'

const CONTACT_FORM_ID = 'contact-form'

type ContactFormValues = {
  email: string
  name: string
  phone?: string
}

type ContactSheetFormProps = {
  form: UseFormReturn<ContactFormValues>
  feedback: string | null
  isPending: boolean
  isEditing: boolean
  pendingReason: string
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  onSubmit: (data: ContactFormValues) => void
  onRequestDelete: () => void
  isSheetOpen: boolean
  historyKey: string
  // Client picker props
  selectedClients: ContactClientOption[]
  availableClients: ContactClientOption[]
  addClientButtonDisabled: boolean
  addClientButtonDisabledReason: string | null
  isClientPickerOpen: boolean
  onClientPickerOpenChange: (open: boolean) => void
  onAddClient: (client: ContactClientOption) => void
  onCreateClient: (query: string) => void
  onRemoveClient: (client: ContactClientOption) => void
  // Promote to client props
  promoteDisabled: boolean
  promoteDisabledReason: string | null
  onRequestPromote: () => void
  /** The portal user this contact was promoted to, if any. */
  portalUserId: string | null
}

export function ContactSheetForm({
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
  selectedClients,
  availableClients,
  addClientButtonDisabled,
  addClientButtonDisabledReason,
  isClientPickerOpen,
  onClientPickerOpenChange,
  onAddClient,
  onCreateClient,
  onRemoveClient,
  promoteDisabled,
  promoteDisabledReason,
  onRequestPromote,
  portalUserId,
}: ContactSheetFormProps) {
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

    return isEditing ? 'Save changes' : 'Create contact'
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

  const fieldDisabledReason = isPending ? pendingReason : null

  return (
    <Form {...form}>
      <div className='flex-1 overflow-y-auto'>
        <form
          id={CONTACT_FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className='flex flex-col gap-6 px-6 pt-6 pb-8'
        >
          <SheetSection title='Details'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={isPending}
                      reason={fieldDisabledReason}
                    >
                      <Input
                        {...field}
                        data-autofocus
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
                        value={field.value ?? ''}
                        placeholder='John Doe'
                        disabled={isPending}
                      />
                    </DisabledFieldTooltip>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid items-start gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={fieldDisabledReason}
                      >
                        <Input
                          {...field}
                          type='email'
                          placeholder='contact@example.com'
                          disabled={isPending}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel optional>Phone</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={fieldDisabledReason}
                      >
                        <PhoneInput
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          disabled={isPending}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </SheetSection>

          <Separator />

          <SheetSection
            title='Clients'
            action={
              <ContactClientLinkButton
                availableClients={availableClients}
                disabled={addClientButtonDisabled}
                disabledReason={addClientButtonDisabledReason}
                isPickerOpen={isClientPickerOpen}
                isPending={isPending}
                onPickerOpenChange={onClientPickerOpenChange}
                onAddClient={onAddClient}
                onCreateClient={onCreateClient}
              />
            }
          >
            <ContactClientList
              selectedClients={selectedClients}
              isPending={isPending}
              pendingReason={pendingReason}
              onRequestRemoval={onRemoveClient}
              onRequestLink={() => onClientPickerOpenChange(true)}
              linkDisabled={addClientButtonDisabled}
              linkDisabledReason={addClientButtonDisabledReason}
            />
          </SheetSection>

          {isEditing ? (
            <>
              <Separator />
              <SheetSection
                title='Portal access'
                description={
                  portalUserId
                    ? 'They can sign in to every client linked above.'
                    : 'Creating an account gives them every client linked above.'
                }
              >
                {portalUserId ? (
                  <ContactPortalAccountCard
                    key={portalUserId}
                    userId={portalUserId}
                  />
                ) : (
                  <LinkedRecordCard
                    icon={User2}
                    title='No portal account'
                    action={
                      <DisabledFieldTooltip
                        disabled={promoteDisabled}
                        reason={promoteDisabledReason}
                        className='w-auto'
                      >
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          disabled={promoteDisabled}
                          onClick={onRequestPromote}
                        >
                          <UserPlus />
                          Create account
                        </Button>
                      </DisabledFieldTooltip>
                    }
                  />
                )}
              </SheetSection>
            </>
          ) : null}
          {feedback ? <p className={FEEDBACK_CLASSES}>{feedback}</p> : null}
        </form>
      </div>
      <SheetFormFooter
        formId={CONTACT_FORM_ID}
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
        deleteAriaLabel='Archive contact'
      />
    </Form>
  )
}
