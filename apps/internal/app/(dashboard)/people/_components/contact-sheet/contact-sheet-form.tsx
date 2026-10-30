'use client'

import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { UserRound, UserPlus } from 'lucide-react'
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
import { PhoneInput } from '@/components/ui/phone-input'
import { Separator } from '@pts/ui/separator'
import { Avatar, AvatarFallback } from '@pts/ui/avatar'
import { AvatarUploadField } from '@/components/forms/avatar-upload-field'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'

import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'

import type { ContactFormData } from '@/lib/settings/contacts/use-contact-sheet-state'

import { ContactCompaniesSection } from './contact-companies-section'
import { ContactSignInFields } from './contact-sign-in-section'
import { SheetTabs, useSheetTab } from '@/components/sheets/sheet-tabs'

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
  promoteDisabled: boolean
  promoteDisabledReason: string | null
  onRequestPromote: () => void
  /** The portal user this contact was promoted to, if any. */
  portalUserId: string | null
  /** Their sign-in (admins only); undefined while loading. */
  signInAccount: PortalAccountSummary | null | undefined
  onSignInChanged: () => void
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
  promoteDisabled,
  promoteDisabledReason,
  onRequestPromote,
  portalUserId,
  signInAccount,
  onSignInChanged,
  onAvatarUploadingChange,
}: ContactSheetFormProps) {
  // Portal accounts grant client access, so they stay admin-only.
  const { isAdmin } = useViewerAccess()
  // The sign-in shows and saves under the person's saved name.
  const personName =
    (form.formState.defaultValues?.name as string | undefined)?.trim() ?? ''
  const tabValues = isAdmin
    ? ['details', 'companies', 'sign-in']
    : ['details', 'companies']
  const [tab, setTab] = useSheetTab(tabValues)
  const dirtyFields = form.formState.dirtyFields
  const detailsDirty = Boolean(
    dirtyFields.name ||
      dirtyFields.email ||
      dirtyFields.phone ||
      dirtyFields.linkedinUrl ||
      dirtyFields.signIn?.avatarPath ||
      dirtyFields.signIn?.avatarRemoved
  )
  const companiesDirty = Boolean(dirtyFields.companies)
  const signInDirty = Boolean(
    dirtyFields.signIn?.role ||
      dirtyFields.signIn?.accessEnabled ||
      dirtyFields.signIn?.password
  )
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
          {isEditing ? (
            <SheetTabs
              value={tab}
              onValueChange={setTab}
              tabs={[
                {
                  value: 'details',
                  label: 'Details',
                  dirty: detailsDirty,
                  content: (
                    <>
          {/* The photo belongs to their sign-in: uploadable once they have
              one (admins), initials otherwise. */}
          {isEditing ? (
            <>
              {isAdmin && portalUserId && signInAccount ? (
                <FormField
                  control={form.control}
                  name='signIn.avatarPath'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <AvatarUploadField
                          key={signInAccount.id}
                          value={field.value ?? null}
                          onChange={next =>
                            form.setValue('signIn.avatarPath', next, {
                              shouldDirty: true,
                            })
                          }
                          onRemovalChange={removed =>
                            form.setValue('signIn.avatarRemoved', removed, {
                              shouldDirty: true,
                            })
                          }
                          onUploadingChange={onAvatarUploadingChange}
                          initials={initialsOf(personName || signInAccount.email)}
                          displayName={personName || null}
                          disabled={isPending}
                          targetUserId={signInAccount.id}
                          existingUserId={signInAccount.id}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className='flex items-center gap-4'>
                  <Avatar className='h-16 w-16'>
                    <AvatarFallback className='text-base font-semibold uppercase'>
                      {initialsOf(personName || '?')}
                    </AvatarFallback>
                  </Avatar>
                  {isAdmin ? (
                    <p className='text-muted-foreground text-xs'>
                      A photo can be added once they have a sign-in.
                    </p>
                  ) : null}
                </div>
              )}
              <Separator />
            </>
          ) : null}
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
                    </>
                  ),
                },
                {
                  value: 'companies',
                  label: 'Companies',
                  dirty: companiesDirty,
                  content: (
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
                  ),
                },
                ...(isAdmin
                  ? [
                      {
                        value: 'sign-in',
                        label: 'Sign-in',
                        dirty: signInDirty,
                        content: (
            <SheetSection
              title='Sign-in'
              description={
                portalUserId
                  ? undefined
                  : 'Lets them sign in. Which clients a client sign-in can see is set on each company (Client > Portal access).'
              }
            >
              {portalUserId ? (
                <ContactSignInFields
                  form={form}
                  account={signInAccount}
                  personName={personName}
                  isPending={isPending}
                  pendingReason={pendingReason}
                  onAccountChanged={onSignInChanged}
                />
              ) : (
                <LinkedRecordCard
                  icon={UserRound}
                  title='No sign-in'
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
                        Create sign-in
                      </Button>
                    </DisabledFieldTooltip>
                  }
                />
              )}
            </SheetSection>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <div className='flex flex-col gap-6 px-6 pt-6 pb-8'>
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
            </div>
          )}
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
