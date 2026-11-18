'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { Plug, SlidersHorizontal, CircleUserRound } from 'lucide-react'

import { Separator } from '@pts/ui/separator'

import { Form } from '@/components/ui/form'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormFooter } from '@/components/sheets/sheet-form-footer'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetSection } from '@/components/sheets/sheet-section'
import { useAccountSheet } from '@/lib/account/use-account-sheet'
import type { AppUser } from '@/lib/auth/session'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import type { SheetSaveMode } from '@/lib/sheets/save-mode'

import { AccountPreferences } from './account-preferences'
import { AccountProfileFields } from './account-profile-fields'
import { PersonalIntegrations } from './personal-integrations'
import {
  useAccountProfile,
  type AccountProfileValues,
} from './use-account-profile'

/**
 * Account: everything that is the signed-in person's own, for every role.
 * Profile is a form saved by the footer; their integrations and preferences
 * act on their own click. Workspace settings (Business, Billing, the
 * agency's integrations) are Admin → Settings.
 *
 * Opened from the user menu, the command palette or `?account=<section>`,
 * over whatever page is open. It isn't a record, so it sits outside the
 * entity sheet stack and always layers on top of it.
 */
export function AccountSheet({ user }: { user: AppUser }) {
  const { section, isOpen, close } = useAccountSheet()
  const formId = useId()
  const profile = useAccountProfile({ user, open: isOpen, onClose: close })
  const { form, save } = profile

  const handleSave = useCallback(
    (mode: SheetSaveMode) => {
      void form.handleSubmit((values: AccountProfileValues) =>
        save(values, mode)
      )()
    },
    [form, save]
  )

  const { undo, redo, canUndo, canRedo } = useSheetFormControls({
    form,
    isActive: isOpen,
    canSave: profile.canSave,
    onSave: handleSave,
    historyKey: `account:${user.id}`,
  })

  const integrationsRef = useRef<HTMLElement>(null)
  const preferencesRef = useRef<HTMLElement>(null)

  // A link to a section (an OAuth return, "Go to integrations") lands on it.
  useEffect(() => {
    const target =
      section === 'integrations'
        ? integrationsRef
        : section === 'preferences'
          ? preferencesRef
          : null
    if (!target) return
    // After the slide-in, so it scrolls the sheet and not the page.
    const timer = setTimeout(
      () => target.current?.scrollIntoView({ block: 'start' }),
      150
    )
    return () => clearTimeout(timer)
  }, [section])

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={next => {
          if (!next) profile.requestClose()
        }}
      >
        <SheetContent
          hideCloseButton
          columns={1}
          // Above any entity sheet it was opened from.
          aboveStack
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            title='Account'
            leading={
              <CircleUserRound
                aria-hidden
                className='text-muted-foreground size-4 shrink-0'
              />
            }
          />
          <Form {...form}>
            <div className='flex flex-1 flex-col gap-6 overflow-y-auto px-6 pt-6 pb-8'>
              <SheetSection title='Profile' icon={CircleUserRound}>
                <form
                  id={formId}
                  onSubmit={event => {
                    event.preventDefault()
                    handleSave('close')
                  }}
                  className='flex flex-col gap-4'
                >
                  <AccountProfileFields
                    form={form}
                    user={user}
                    isPending={profile.isPending}
                    avatarFieldKey={profile.avatarFieldKey}
                    onUploadingChange={profile.setIsAvatarUploading}
                  />
                </form>
              </SheetSection>
              <Separator />
              <SheetSection
                ref={integrationsRef}
                title='Integrations'
                icon={Plug}
                description='Your own accounts. Connect what you use; nobody else sees them, and each connects or disconnects at once.'
                className='scroll-mt-6'
              >
                <PersonalIntegrations />
              </SheetSection>
              <Separator />
              <SheetSection
                ref={preferencesRef}
                title='Preferences'
                icon={SlidersHorizontal}
                description='This browser only.'
                className='scroll-mt-6'
              >
                <AccountPreferences />
              </SheetSection>
            </div>
            <SheetFormFooter
              formId={formId}
              saveLabel={profile.saveLabel}
              onSave={handleSave}
              submitDisabled={!profile.canSave}
              submitDisabledReason={profile.saveDisabledReason}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              isEditing
            />
          </Form>
        </SheetContent>
      </Sheet>
      {profile.unsavedChangesDialog}
    </>
  )
}
