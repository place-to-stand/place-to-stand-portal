'use client'

import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { User2, UserPlus } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { FormFeedback } from '@/components/sheets/form-feedback'
import { getSubmitLabel } from '@/lib/forms/form-controls'
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
import { UrlInput } from '@/components/ui/url-input'
import { CompanyLinkPicker } from '@/components/companies/company-link-picker'
import { PhoneInput } from '@/components/ui/phone-input'
import { Separator } from '@pts/ui/separator'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'

import {
  ContactClientList,
  type ContactClientOption,
} from './contact-client-picker'
import { ContactPortalAccountCard } from './contact-portal-account-card'

const CONTACT_FORM_ID = 'contact-form'

type ContactFormValues = {
  email: string
  name: string
  phone?: string
  jobTitle?: string
  linkedinUrl?: string
  company: { id: string; name: string } | null
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
  /** The contact's clients — derived from its company, shown read-only. */
  linkedClients: ContactClientOption[]
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
  linkedClients,
  promoteDisabled,
  promoteDisabledReason,
  onRequestPromote,
  portalUserId,
}: ContactSheetFormProps) {
  // Portal accounts grant client access, so they stay admin-only.
  const { isAdmin } = useViewerAccess()
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

  const saveLabel = getSubmitLabel({
    isSaving: isPending,
    isEditing,
    createLabel: 'Create contact',
  })

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
            <div className='grid grid-cols-1 items-start gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel optional>Email</FormLabel>
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

          <SheetSection title='Work'>
            <div className='grid grid-cols-1 items-start gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='company'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel optional>Company</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={fieldDisabledReason}
                      >
                        <CompanyLinkPicker
                          value={field.value ?? null}
                          onChange={next => field.onChange(next)}
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
                name='jobTitle'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel optional>Job title</FormLabel>
                    <FormControl>
                      <DisabledFieldTooltip
                        disabled={isPending}
                        reason={fieldDisabledReason}
                      >
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder='Head of Marketing'
                          disabled={isPending}
                        />
                      </DisabledFieldTooltip>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='linkedinUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel optional>LinkedIn</FormLabel>
                  <FormControl>
                    <DisabledFieldTooltip
                      disabled={isPending}
                      reason={fieldDisabledReason}
                    >
                      <UrlInput
                        {...field}
                        value={field.value ?? ''}
                        openLabel='Open LinkedIn'
                        placeholder='linkedin.com/in/jane-doe'
                        disabled={isPending}
                      />
                    </DisabledFieldTooltip>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SheetSection>

          <Separator />

          <SheetSection
            title='Portal access'
            description='The clients they can see in the client portal, set on each client’s Portal access.'
          >
            <ContactClientList clients={linkedClients} />
            {isEditing && isAdmin ? (
              portalUserId ? (
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
              )
            ) : null}
          </SheetSection>
          <FormFeedback>{feedback}</FormFeedback>
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
