'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SheetFormHeader } from '@/components/sheets/sheet-form-header'
import {
  useContactSheetState,
  type UseContactSheetStateOptions,
} from '@/lib/settings/contacts/use-contact-sheet-state'

import { useWatch } from 'react-hook-form'
import { UserAvatar } from '@/components/ui/user-avatar'

import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'

import { ContactSheetForm } from './contact-sheet/contact-sheet-form'
import { RoleBadge } from '@/components/auth/role-badge'

const ARCHIVE_CONTACT_DIALOG_TITLE = 'Archive person?'
const ARCHIVE_CONTACT_CONFIRM_LABEL = 'Archive'

function getArchiveContactDialogDescription(displayName: string) {
  return `Archiving ${displayName} hides them from active views but keeps their record.`
}

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
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    signInAccount,
    savedSignInRole,
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
          />

          <ContactSheetForm
            form={form}
            isPending={isPending}
            companiesLoadFailed={companiesLoadFailed}
            isEditing={isEditing}
            pendingReason={pendingReason}
            submitDisabled={submitDisabled}
            submitDisabledReason={submitDisabledReason}
            deleteDisabled={deleteDisabled}
            deleteDisabledReason={deleteDisabledReason}
            onSubmit={handleFormSubmit}
            onRequestDelete={handleRequestDelete}
            isSheetOpen={open}
            historyKey={contact?.id ?? 'contact:new'}
            contactId={contact?.id ?? null}
            portalUserId={portalUserId}
            signInAccount={signInAccount}
            savedSignInRole={savedSignInRole}
            roleMonths={roleMonths}
            canManageSignIn={canManageSignIn}
            readOnly={readOnly}
            onAvatarUploadingChange={setIsAvatarUploading}
          />
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={ARCHIVE_CONTACT_DIALOG_TITLE}
        description={getArchiveContactDialogDescription(contactDisplayName)}
        confirmLabel={ARCHIVE_CONTACT_CONFIRM_LABEL}
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}
