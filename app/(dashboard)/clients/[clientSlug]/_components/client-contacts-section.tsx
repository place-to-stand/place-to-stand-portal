'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Contact, Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  ContactSelector,
  type ContactSelectorContact,
} from '@/components/contacts/contact-selector'
import { ContactsSheet } from '@/app/(dashboard)/contacts/_components/contacts-sheet'
import type { ContactWithClientLink } from '@/lib/types/client-contacts'
import {
  updateClientContact,
  deleteClientContact,
  getAllContacts,
  linkContactToClient,
} from '../actions'

type Props = {
  clientId: string
  contacts: ContactWithClientLink[]
  canManage: boolean
}

type EditingContact = {
  id: string
  email: string
  name: string
  isPrimary: boolean
}

export function ClientContactsSection({ clientId, contacts, canManage }: Props) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [allContacts, setAllContacts] = useState<ContactSelectorContact[]>([])
  const [editing, setEditing] = useState<EditingContact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContactWithClientLink | null>(
    null
  )

  // Fetch all contacts when add mode opens
  useEffect(() => {
    if (isAddingContact && canManage) {
      getAllContacts()
        .then(setAllContacts)
        .catch(err => console.error('Failed to fetch contacts:', err))
    }
  }, [isAddingContact, canManage])

  // IDs already linked to this client
  const linkedContactIds = contacts.map(c => c.id)

  const handleSelectContact = useCallback(
    (contactId: string | null) => {
      if (!contactId) return

      startTransition(async () => {
        const result = await linkContactToClient({
          contactId,
          clientId,
          isPrimary: false,
        })

        if (result.success) {
          toast({ title: 'Contact linked' })
          setIsAddingContact(false)
        } else {
          toast({
            title: 'Error',
            description: result.error,
            variant: 'destructive',
          })
        }
      })
    },
    [clientId, toast]
  )

  const handleCreateNew = useCallback(() => {
    setIsSheetOpen(true)
  }, [])

  const handleSheetComplete = useCallback(() => {
    setIsSheetOpen(false)
    // Refresh contacts list after creation
    getAllContacts()
      .then(setAllContacts)
      .catch(err => console.error('Failed to refresh contacts:', err))
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editing) return

    startTransition(async () => {
      const result = await updateClientContact(editing.id, clientId, {
        email: editing.email,
        name: editing.name,
        isPrimary: editing.isPrimary,
      })

      if (result.success) {
        toast({ title: 'Contact updated' })
        setEditing(null)
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      }
    })
  }, [editing, clientId, toast])

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return

    startTransition(async () => {
      const result = await deleteClientContact(deleteTarget.id, clientId)
      if (result.success) {
        toast({ title: 'Contact removed' })
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      }
      setDeleteTarget(null)
    })
  }, [deleteTarget, clientId, toast])

  return (
    <>
      <section className='bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm'>
        <div className='bg-muted/30 flex items-center justify-between gap-3 border-b px-6 py-4'>
          <div className='flex items-center gap-3'>
            <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border shadow-sm'>
              <Contact className='h-4 w-4 text-cyan-500' />
            </div>
            <h2 className='text-lg font-semibold tracking-tight'>Contacts</h2>
            <Badge variant='secondary'>{contacts.length}</Badge>
          </div>
          {canManage && !isAddingContact && !editing && (
            <Button size='sm' onClick={() => setIsAddingContact(true)}>
              <Plus className='mr-1 h-4 w-4' /> Add
            </Button>
          )}
        </div>

        <div className='p-6'>
          {isAddingContact && (
            <div className='mb-4 flex items-center gap-2'>
              <div className='flex-1'>
                <ContactSelector
                  contacts={allContacts}
                  excludeIds={linkedContactIds}
                  onChange={handleSelectContact}
                  onCreateNew={handleCreateNew}
                  disabled={isPending}
                />
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsAddingContact(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          )}

          {contacts.length === 0 && !isAddingContact ? (
            <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
              No contacts. Add email addresses to enable automatic email linking.
            </div>
          ) : (
            <div className='space-y-2'>
              {contacts.map(c =>
                editing?.id === c.id ? (
                  <ContactEditForm
                    key={c.id}
                    value={editing}
                    onChange={setEditing}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditing(null)}
                    isPending={isPending}
                  />
                ) : (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    canManage={canManage && !isAddingContact}
                    onEdit={() =>
                      setEditing({
                        id: c.id,
                        email: c.email,
                        name: c.name ?? '',
                        isPrimary: c.isPrimary,
                      })
                    }
                    onDelete={() => setDeleteTarget(c)}
                  />
                )
              )}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!deleteTarget}
          title='Remove contact?'
          description={`Remove ${deleteTarget?.email}? Emails from this address will no longer auto-link to this client.`}
          confirmLabel='Remove'
          confirmVariant='destructive'
          confirmDisabled={isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </section>

      {/* ContactSheet for creating new contacts */}
      <ContactsSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onComplete={handleSheetComplete}
        contact={null}
      />
    </>
  )
}

function ContactRow({
  contact,
  canManage,
  onEdit,
  onDelete,
}: {
  contact: ContactWithClientLink
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className='flex items-center justify-between gap-4 rounded-md px-3 py-2 hover:bg-muted/50'>
      <div className='flex min-w-0 items-center gap-3'>
        <span className='truncate font-medium'>{contact.email}</span>
        {contact.name && (
          <span className='text-muted-foreground truncate text-sm'>
            ({contact.name})
          </span>
        )}
        {contact.isPrimary && (
          <Badge variant='outline' className='shrink-0'>
            <Star className='mr-1 h-3 w-3 fill-current' /> Primary
          </Badge>
        )}
      </div>
      {canManage && (
        <div className='flex shrink-0 gap-1'>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={onEdit}
          >
            <Pencil className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={onDelete}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      )}
    </div>
  )
}

function ContactEditForm({
  value,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  value: EditingContact
  onChange: (v: EditingContact) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className='flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-3 py-2'>
      <Input
        type='email'
        placeholder='email@example.com'
        value={value.email}
        onChange={e => onChange({ ...value, email: e.target.value })}
        className='w-56'
        disabled={isPending}
      />
      <Input
        placeholder='Name'
        value={value.name}
        onChange={e => onChange({ ...value, name: e.target.value })}
        className='w-40'
        disabled={isPending}
      />
      <label className='flex cursor-pointer items-center gap-2 text-sm'>
        <Checkbox
          checked={value.isPrimary}
          onCheckedChange={checked => onChange({ ...value, isPrimary: !!checked })}
          disabled={isPending}
        />
        Primary
      </label>
      <div className='ml-auto flex gap-1'>
        <Button size='sm' variant='ghost' onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button size='sm' onClick={onSave} disabled={isPending || !value.email}>
          {isPending ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}
