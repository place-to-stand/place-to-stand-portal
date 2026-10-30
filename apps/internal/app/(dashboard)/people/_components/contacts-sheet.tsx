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

import { MoreHorizontal, UserRound } from 'lucide-react'
import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pts/ui/dropdown-menu'
import { UserAvatar } from '@/components/ui/user-avatar'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { SHEET_TAB_PARAM } from '@/components/sheets/sheet-tabs'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

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
  const { isAdmin } = useViewerAccess()
  const { setAux } = useSheetParams()
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
    promoteRole,
    setPromoteRole,
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
          <SheetFormHeader
            entity='contact'
            title={isEditing ? contactDisplayName : sheetTitle}
            leading={
              isEditing ? (
                <UserAvatar
                  userId={portalUserId}
                  name={contactDisplayName}
                  hasPhoto={Boolean(signInAccount?.avatarUrl)}
                  version={signInAccount?.avatarUrl ?? null}
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
            menu={
              isAdmin && isEditing ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        aria-label='Person actions'
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    {portalUserId ? (
                      <DropdownMenuItem
                        onClick={() => setAux(SHEET_TAB_PARAM, 'sign-in')}
                      >
                        Sign-in settings
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled={promoteDisabled}
                        onClick={handleRequestPromote}
                      >
                        Create sign-in…
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
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
        role={promoteRole}
        onRoleChange={setPromoteRole}
      />
      {unsavedChangesDialog}
    </>
  )
}
