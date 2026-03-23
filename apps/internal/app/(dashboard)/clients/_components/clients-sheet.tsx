'use client'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'

import {
  ARCHIVE_CLIENT_CONFIRM_LABEL,
  ARCHIVE_CLIENT_DIALOG_TITLE,
  getArchiveClientDialogDescription,
} from '@/lib/settings/clients/client-sheet-constants'

import type { UseClientSheetStateArgs } from '@/lib/settings/clients/use-client-sheet-state'
import { useClientSheetState } from '@/lib/settings/clients/use-client-sheet-state'

import { ClientSheetForm } from './client-sheet/client-sheet-form'
import { ClientSheetHeader } from './client-sheet/client-sheet-header'

type ClientSheetProps = UseClientSheetStateArgs

export function ClientSheet(props: ClientSheetProps) {
  const {
    form,
    isEditing,
    feedback,
    isPending,
    submitDisabled,
    submitDisabledReason,
    deleteDisabled,
    deleteDisabledReason,
    pendingReason,
    isDeleteDialogOpen,
    clientDisplayName,
    sheetTitle,
    sheetDescription,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    // Contacts
    selectedContacts,
    availableContacts,
    isContactPickerOpen,
    contactsAddButtonDisabled,
    contactsAddButtonDisabledReason,
    handleContactPickerOpenChange,
    handleAddContact,
    handleRemoveContact,
    // Referral
    selectedReferral,
    availableReferralContacts,
    isReferralPickerOpen,
    referralPickerDisabled,
    referralPickerDisabledReason,
    handleReferralPickerOpenChange,
    handleSelectReferral,
    handleClearReferral,
  } = useClientSheetState(props)

  return (
    <>
      <Sheet open={props.open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-32 sm:max-w-lg'>
          <ClientSheetHeader
            title={sheetTitle}
            description={sheetDescription}
          />
          <ClientSheetForm
            form={form}
            feedback={feedback}
            isPending={isPending}
            isEditing={isEditing}
            pendingReason={pendingReason}
            submitDisabled={submitDisabled}
            submitDisabledReason={submitDisabledReason}
            deleteDisabled={deleteDisabled}
            deleteDisabledReason={deleteDisabledReason}
            onSubmit={handleFormSubmit}
            onRequestDelete={handleRequestDelete}
            isSheetOpen={props.open}
            historyKey={props.client?.id ?? 'client:new'}
            selectedContacts={selectedContacts}
            availableContacts={availableContacts}
            contactsAddButtonDisabled={contactsAddButtonDisabled}
            contactsAddButtonDisabledReason={contactsAddButtonDisabledReason}
            isContactPickerOpen={isContactPickerOpen}
            onContactPickerOpenChange={handleContactPickerOpenChange}
            onAddContact={handleAddContact}
            onRemoveContact={handleRemoveContact}
            selectedReferral={selectedReferral}
            availableReferralContacts={availableReferralContacts}
            referralPickerDisabled={referralPickerDisabled}
            referralPickerDisabledReason={referralPickerDisabledReason}
            isReferralPickerOpen={isReferralPickerOpen}
            onReferralPickerOpenChange={handleReferralPickerOpenChange}
            onSelectReferral={handleSelectReferral}
            onClearReferral={handleClearReferral}
          />
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={ARCHIVE_CLIENT_DIALOG_TITLE}
        description={getArchiveClientDialogDescription(clientDisplayName)}
        confirmLabel={ARCHIVE_CLIENT_CONFIRM_LABEL}
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      {unsavedChangesDialog}
    </>
  )
}
