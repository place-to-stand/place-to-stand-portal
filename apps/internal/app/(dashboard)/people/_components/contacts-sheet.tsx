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
import { UserRound } from 'lucide-react'
import { Badge } from '@pts/ui/badge'
import { UserAvatar } from '@/components/ui/user-avatar'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'

import { ContactSheetForm } from './contact-sheet/contact-sheet-form'

const ARCHIVE_CONTACT_DIALOG_TITLE = 'Archive person?'
const ARCHIVE_CONTACT_CONFIRM_LABEL = 'Archive'

function getArchiveContactDialogDescription(displayName: string) {
  return `Archiving ${displayName} hides them from active views but keeps their record.`
}

type ContactsSheetProps = UseContactSheetStateOptions

export function ContactsSheet(props: ContactsSheetProps) {
  const { open, contact, onComplete } = props
  const queryClient = useQueryClient()
  const { isAdmin } = useViewerAccess()
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
    portalUserId,
    unsavedChangesDialog,
    handleSheetOpenChange,
    handleFormSubmit,
    handleRequestDelete,
    handleCancelDelete,
    handleConfirmDelete,
    signInAccount,
    setIsAvatarUploading,
  } = useContactSheetState({ ...props, onComplete: handleComplete })
  // The header shows the photo as staged, so an upload shows at once.
  const avatarPath = useWatch({ control: form.control, name: 'avatarPath' })

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          hideCloseButton
          size='2xl'
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
                <UserRound
                  aria-hidden
                  className={`${ENTITY_ACCENTS.contact.icon} size-4`}
                />
              )
            }
            badges={
              isAdmin && signInAccount ? (
                <Badge variant='outline' className='text-xs font-normal'>
                  {ROLE_LABELS[signInAccount.role]}
                  {signInAccount.deletedAt
                    ? ' · archived'
                    : signInAccount.disabledAt
                      ? ' · off'
                      : ''}
                </Badge>
              ) : null
            }
          />

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
            contactId={contact?.id ?? null}
            portalUserId={portalUserId}
            signInAccount={signInAccount}
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
