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

import { ContactSheetForm } from './contact-sheet/contact-sheet-form'
import { PromoteToUserDialog } from './contact-sheet/promote-to-user-dialog'

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
    feedback,
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
    isPromoteDialogOpen,
    setIsPromoteDialogOpen,
    portalUserId,
    promoteDisabled,
    promoteDisabledReason,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    handleRequestPromote,
    handleConfirmPromote,
    signInAccount,
    reloadSignIn,
    setIsAvatarUploading,
  } = useContactSheetState({ ...props, onComplete: handleComplete })

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          size='2xl'
          className='flex w-full flex-col gap-0 overflow-hidden p-0'
        >
          <SheetFormHeader entity='contact' title={sheetTitle} />
          <ContactSheetForm
            form={form}
            feedback={feedback}
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
            promoteDisabled={promoteDisabled}
            promoteDisabledReason={promoteDisabledReason}
            onRequestPromote={handleRequestPromote}
            portalUserId={portalUserId}
            signInAccount={signInAccount}
            onSignInChanged={() => void reloadSignIn()}
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
      <PromoteToUserDialog
        open={isPromoteDialogOpen}
        onOpenChange={setIsPromoteDialogOpen}
        contactName={contactDisplayName}
        contactEmail={contact?.email ?? ''}
        isPending={isPending}
        onConfirm={handleConfirmPromote}
      />
      {unsavedChangesDialog}
    </>
  )
}
