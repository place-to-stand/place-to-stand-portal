'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { SaveConflictDialog } from '@/components/sheets/save-conflict-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import { SheetRecordMenu } from '@/components/sheets/sheet-record-menu'
import { SheetPresence } from '@/components/sheets/sheet-presence'
import {
  useContactSheetState,
  type UseContactSheetStateOptions,
} from '@/lib/people/use-contact-sheet-state'

import { useWatch } from 'react-hook-form'
import { UserAvatar } from '@/components/ui/user-avatar'

import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'

import { ContactSheetForm } from './contact-sheet/contact-sheet-form'
import { RoleBadge } from '@/components/auth/role-badge'

type ContactsSheetProps = UseContactSheetStateOptions

export function ContactsSheet(props: ContactsSheetProps) {
  const { open, contact, onComplete } = props
  const queryClient = useQueryClient()

  // A company sheet stacked underneath lists this contact's title and
  // primary star: refetch it so its Save doesn't write back stale values.
  const handleComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['companySheet'] })
    onComplete()
  }, [onComplete, queryClient])
  const {
    form,
    isPending,
    isReloading,
    companiesLoaded,
    companiesLoadFailed,
    isEditing,
    pendingReason,
    sheetTitle,
    contactDisplayName,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    isDeleteDialogOpen,
    portalUserId,
    unsavedChangesDialog,
    saveConflict,
    handleLoadTheirs,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    signInAccount,
    roleMonths,
    canManageSignIn,
    readOnly,
    setIsAvatarUploading,
  } = useContactSheetState({ ...props, onComplete: handleComplete })
  // The header shows the photo as staged, so an upload shows at once.
  const avatarPath = useWatch({ control: form.control, name: 'avatarPath' })

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          columns={1}
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader
            entity='contact'
            presence={
              <SheetPresence
                entity='contact'
                noun='person'
                recordId={contact?.id ?? null}
                open={open}
                isDirty={form.formState.isDirty}
                guard={saveConflict}
                onLoadTheirs={handleLoadTheirs}
              />
            }
            title={isEditing ? contactDisplayName : sheetTitle}
            leading={
              isEditing ? (
                <UserAvatar
                  contactId={contact?.id}
                  name={contactDisplayName}
                  hasPhoto={Boolean(avatarPath)}
                  version={avatarPath}
                  size='sm'
                />
              ) : (
                <ENTITY_ICONS.contact
                  aria-hidden
                  className={`${ENTITY_ACCENTS.contact.icon} size-4`}
                />
              )
            }
            badges={
              canManageSignIn && signInAccount ? (
                <RoleBadge
                  role={signInAccount.role}
                  state={
                    signInAccount.deletedAt
                      ? 'archived'
                      : signInAccount.disabledAt
                        ? 'off'
                        : null
                  }
                />
              ) : null
            }
            menu={
              isEditing ? (
                <SheetRecordMenu
                  noun='Person'
                  onRequestArchive={handleRequestDelete}
                  archiveDisabled={deleteDisabled}
                  archiveDisabledReason={deleteDisabledReason}
                />
              ) : null
            }
          />

          <ContactSheetForm
            form={form}
            // A keep-open save reads the person back: hold the fields too.
            isPending={isPending || isReloading}
            companiesLoaded={companiesLoaded}
            companiesLoadFailed={companiesLoadFailed}
            isEditing={isEditing}
            pendingReason={pendingReason}
            submitDisabled={submitDisabled}
            submitDisabledReason={submitDisabledReason}
            onSubmit={handleFormSubmit}
            isSheetOpen={open}
            historyKey={contact?.id ?? 'contact:new'}
            contactId={contact?.id ?? null}
            portalUserId={portalUserId}
            signInAccount={signInAccount}
            roleMonths={roleMonths}
            canManageSignIn={canManageSignIn}
            readOnly={readOnly}
            onAvatarUploadingChange={setIsAvatarUploading}
          />
        </SheetContent>
      </Sheet>
      <ArchiveConfirmDialog
        open={isDeleteDialogOpen}
        entity='person'
        name={contactDisplayName}
        list='active people'
        pending={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
      <SaveConflictDialog
        guard={saveConflict}
        noun='person'
        onOverwrite={mode =>
          void form.handleSubmit(data => handleFormSubmit(data, mode))()
        }
        onLoadTheirs={handleLoadTheirs}
      />
    </>
  )
}
