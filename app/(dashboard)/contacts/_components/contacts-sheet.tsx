'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'

import { saveContact, softDeleteContact } from '../actions'
import type { ContactsTableContact } from '@/lib/settings/contacts/use-contacts-table-state'

import { ContactSheetHeader } from './contact-sheet/contact-sheet-header'
import { ContactSheetForm } from './contact-sheet/contact-sheet-form'

const contactFormSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required').max(160),
  phone: z.string().max(40).optional(),
})

type ContactFormData = z.infer<typeof contactFormSchema>

type ContactsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  contact?: ContactsTableContact | null
}

const ARCHIVE_CONTACT_DIALOG_TITLE = 'Archive contact?'
const ARCHIVE_CONTACT_CONFIRM_LABEL = 'Archive'

function getArchiveContactDialogDescription(displayName: string) {
  return `Archiving ${displayName} hides it from active views but preserves the record.`
}

export function ContactsSheet({
  open,
  onOpenChange,
  onComplete,
  contact,
}: ContactsSheetProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { toast } = useToast()
  const isEditing = Boolean(contact?.id)

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: '',
      name: '',
      phone: '',
    },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      setFeedback(null)
      form.reset({
        email: contact?.email ?? '',
        name: contact?.name ?? '',
        phone: contact?.phone ?? '',
      })
    })
  }, [open, contact, form])

  const contactDisplayName = contact?.name || contact?.email || 'this contact'
  const sheetTitle = isEditing ? 'Edit Contact' : 'Add Contact'
  const sheetDescription = isEditing
    ? `Update the details for ${contactDisplayName}.`
    : 'Add a new contact to your organization.'

  const pendingReason = 'Please wait for the current action to complete.'

  const submitDisabled = isPending || !form.formState.isDirty
  const submitDisabledReason = isPending
    ? pendingReason
    : !form.formState.isDirty
      ? 'No changes to save.'
      : null

  const deleteDisabled = isPending || !isEditing
  const deleteDisabledReason = isPending
    ? pendingReason
    : !isEditing
      ? 'Cannot archive a new contact.'
      : null

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isPending) {
        return
      }
      onOpenChange(nextOpen)
    },
    [isPending, onOpenChange]
  )

  const handleFormSubmit = useCallback(
    (data: ContactFormData) => {
      setFeedback(null)
      startTransition(async () => {
        const result = await saveContact({
          id: contact?.id,
          email: data.email,
          name: data.name,
          phone: data.phone || null,
        })

        if (result.error) {
          setFeedback(result.error)
          toast({
            title: isEditing ? 'Unable to update contact' : 'Unable to create contact',
            description: result.error,
            variant: 'destructive',
          })
          return
        }

        toast({
          title: isEditing ? 'Contact updated' : 'Contact created',
          description: isEditing
            ? `${data.name || data.email} has been updated.`
            : `${data.name || data.email} has been created.`,
        })
        onComplete()
      })
    },
    [contact?.id, isEditing, toast, onComplete]
  )

  const handleRequestDelete = useCallback(() => {
    if (!isEditing || isPending) {
      return
    }
    setIsDeleteDialogOpen(true)
  }, [isEditing, isPending])

  const handleCancelDelete = useCallback(() => {
    if (isPending) {
      return
    }
    setIsDeleteDialogOpen(false)
  }, [isPending])

  const handleConfirmDelete = useCallback(() => {
    const contactId = contact?.id
    const displayName = contact?.name || contact?.email || 'this contact'

    if (!contactId || isPending) {
      setIsDeleteDialogOpen(false)
      return
    }

    setIsDeleteDialogOpen(false)
    startTransition(async () => {
      const result = await softDeleteContact({ id: contactId })

      if (result.error) {
        setFeedback(result.error)
        toast({
          title: 'Unable to archive contact',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Contact archived',
        description: `${displayName} has been archived.`,
      })
      onComplete()
    })
  }, [contact, isPending, toast, onComplete])

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className='flex w-full flex-col gap-6 overflow-y-auto pb-32 sm:max-w-lg'>
          <ContactSheetHeader
            title={sheetTitle}
            description={sheetDescription}
          />
          <ContactSheetForm
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
            isSheetOpen={open}
            historyKey={contact?.id ?? 'contact:new'}
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
    </>
  )
}
