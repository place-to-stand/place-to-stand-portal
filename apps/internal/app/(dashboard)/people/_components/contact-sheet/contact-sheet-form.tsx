'use client'

import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { FormFeedback } from '@/components/sheets/form-feedback'
import { getSubmitLabel } from '@/lib/forms/form-controls'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetSection } from '@/components/sheets/sheet-section'
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
import { PhoneInput } from '@/components/ui/phone-input'
import { Separator } from '@pts/ui/separator'
import { AvatarUploadField } from '@/components/forms/avatar-upload-field'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'

import type { ContactFormData } from '@/lib/settings/contacts/use-contact-sheet-state'

import { ContactCompaniesSection } from './contact-companies-section'
import { ContactSignInFields } from './contact-sign-in-section'

const CONTACT_FORM_ID = 'contact-form'

type ContactFormValues = ContactFormData

type ContactSheetFormProps = {
  form: UseFormReturn<ContactFormValues>
  feedback: string | null
  isPending: boolean
  isEditing: boolean
  /** The contact's companies failed to load; the list can't be edited. */
  companiesLoadFailed: boolean
  pendingReason: string
  submitDisabled: boolean
  submitDisabledReason: string | null
  deleteDisabled: boolean
  deleteDisabledReason: string | null
  onSubmit: (data: ContactFormValues) => void
  onRequestDelete: () => void
  isSheetOpen: boolean
  historyKey: string
  // Promote to client props
  /** The person's id (null while creating). */
  contactId: string | null
  /** The portal user this contact was promoted to, if any. */
  portalUserId: string | null
  /** Their sign-in (admins only); undefined while loading. */
  signInAccount: PortalAccountSummary | null | undefined
  onAvatarUploadingChange: (uploading: boolean) => void
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : parts[0]?.slice(0, 2)
  return (letters ?? '?').toUpperCase()
}

export function ContactSheetForm({
  form,
  feedback,
  isPending,
  companiesLoadFailed,
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
  contactId,
  portalUserId,
  signInAccount,
  onAvatarUploadingChange,
}: ContactSheetFormProps) {
  // Portal accounts grant client access, so they stay admin-only.
  const { isAdmin } = useViewerAccess()
  // The sign-in shows and saves under the person's saved name and email.
  const personName =
    (form.formState.defaultValues?.name as string | undefined)?.trim() ?? ''
  const savedEmail =
    (form.formState.defaultValues?.email as string | undefined)?.trim() ?? ''
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
    createLabel: 'Create person',
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
          className='flex flex-col'
        >
          <div className='flex flex-col gap-6 px-6 pt-6 pb-8'>
          {/* Their photo: anyone can have one. */}
          <FormField
            control={form.control}
            name='avatarPath'
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AvatarUploadField
                    value={field.value ?? null}
                    onChange={next =>
                      form.setValue('avatarPath', next, { shouldDirty: true })
                    }
                    onRemovalChange={removed =>
                      form.setValue('avatarRemoved', removed, {
                        shouldDirty: true,
                      })
                    }
                    onUploadingChange={onAvatarUploadingChange}
                    initials={initialsOf(personName || '?')}
                    displayName={personName || null}
                    disabled={isPending}
                    contactId={contactId}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Separator />
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
              {/* Under Email, in its column. */}
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
            </div>
          </SheetSection>
            <Separator />
          <FormField
            control={form.control}
            name='companies'
            render={({ field }) => (
              <ContactCompaniesSection
                companies={field.value}
                disabled={isPending}
                loadFailed={companiesLoadFailed}
                onChange={next => field.onChange(next)}
              />
            )}
          />
            {isEditing && isAdmin ? (
              <>
                <Separator />
                          <SheetSection title='Sign-in'>
                            <ContactSignInFields
                              form={form}
                              account={portalUserId ? signInAccount : null}
                              hasSignIn={Boolean(portalUserId)}
                              contactId={contactId}
                              personName={personName}
                              personEmail={savedEmail}
                              isPending={isPending}
                              pendingReason={pendingReason}
                            />
                          </SheetSection>
              </>
            ) : null}
          </div>
          <div className='px-6 pb-6 empty:hidden'>
            <FormFeedback>{feedback}</FormFeedback>
          </div>
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
        deleteAriaLabel='Archive person'
      />
    </Form>
  )
}
