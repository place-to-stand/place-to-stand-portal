'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Plus, Pencil, Trash2, Star, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  ContactSelector,
  type ContactSelectorContact,
} from '@/components/contacts/contact-selector'
import { ContactsSheet } from '@/app/(dashboard)/contacts/_components/contacts-sheet'
import type { ContactWithClientLink } from '@/lib/types/client-contacts'
import {
  deleteClientContact,
  getAllContacts,
  linkContactToClient,
} from '../actions'

type Props = {
  clientId: string
  contacts: ContactWithClientLink[]
  canManage: boolean
}

export function ClientContactsSection({ clientId, contacts, canManage }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create')
  const [editingContact, setEditingContact] = useState<ContactWithClientLink | null>(null)
  const [allContacts, setAllContacts] = useState<ContactSelectorContact[]>([])
  const [deleteTarget, setDeleteTarget] = useState<ContactWithClientLink | null>(null)

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
    setSheetMode('create')
    setEditingContact(null)
    setIsSheetOpen(true)
  }, [])

  const handleEditContact = useCallback((contact: ContactWithClientLink) => {
    setSheetMode('edit')
    setEditingContact(contact)
    setIsSheetOpen(true)
  }, [])

  const handleSheetComplete = useCallback(() => {
    setIsSheetOpen(false)
    setEditingContact(null)
    setIsAddingContact(false)
    // Refresh contacts list after changes
    getAllContacts()
      .then(setAllContacts)
      .catch(err => console.error('Failed to refresh contacts:', err))
    router.refresh()
  }, [router])

  // Called when a new contact is created - auto-link to this client
  const handleContactCreated = useCallback(
    (contactId: string) => {
      startTransition(async () => {
        const result = await linkContactToClient({
          contactId,
          clientId,
          isPrimary: false,
        })

        if (result.success) {
          toast({ title: 'Contact created and linked' })
        } else {
          toast({
            title: 'Contact created but linking failed',
            description: result.error,
            variant: 'destructive',
          })
        }
      })
    },
    [clientId, toast]
  )

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return

    startTransition(async () => {
      const result = await deleteClientContact(deleteTarget.id, clientId)
      if (result.success) {
        toast({ title: 'Contact removed from client' })
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

  // Map ContactWithClientLink to the shape ContactsSheet expects
  const sheetContact = editingContact
    ? {
        id: editingContact.id,
        email: editingContact.email,
        name: editingContact.name ?? '',
        phone: editingContact.phone,
      }
    : null

  return (
    <>
      <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
        <div className='flex items-center gap-3 border-b px-4 py-3'>
          <div className='flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/10'>
            <Users className='h-4 w-4 text-cyan-500' />
          </div>
          <h2 className='font-semibold'>Contacts</h2>
          <Badge variant='secondary' className='ml-auto'>
            {contacts.length}
          </Badge>
          {canManage && !isAddingContact && (
            <Button
              size='sm'
              variant='ghost'
              className='h-7 px-2'
              onClick={() => setIsAddingContact(true)}
            >
              <Plus className='h-4 w-4' />
            </Button>
          )}
        </div>

        <div className='p-3'>
          {isAddingContact && (
            <div className='mb-3 flex items-center gap-2'>
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
            <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
              No contacts linked yet.
            </div>
          ) : (
            <div className='divide-y'>
              {contacts.map(c => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  canManage={canManage && !isAddingContact}
                  onEdit={() => handleEditContact(c)}
                  onDelete={() => setDeleteTarget(c)}
                />
              ))}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!deleteTarget}
          title='Remove contact from client?'
          description={`Remove ${deleteTarget?.email} from this client? The contact will remain available for other clients.`}
          confirmLabel='Remove'
          confirmVariant='destructive'
          confirmDisabled={isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </section>

      <ContactsSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onComplete={handleSheetComplete}
        onCreated={sheetMode === 'create' ? handleContactCreated : undefined}
        contact={sheetContact}
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
    <div className='group flex items-start gap-3 px-3 py-2.5'>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          {contact.name ? (
            <span className='truncate text-sm font-medium'>{contact.name}</span>
          ) : (
            <span className='text-muted-foreground truncate text-sm'>
              No name
            </span>
          )}
          {contact.isPrimary && (
            <Star className='h-3 w-3 shrink-0 fill-amber-400 text-amber-400' />
          )}
        </div>
        <a
          href={`mailto:${contact.email}`}
          className='text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1.5 text-xs transition'
          onClick={e => e.stopPropagation()}
        >
          <Mail className='h-3 w-3' />
          {contact.email}
        </a>
      </div>
      {canManage && (
        <div className='flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100'>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7'
            onClick={onEdit}
          >
            <Pencil className='h-3.5 w-3.5' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7'
            onClick={onDelete}
          >
            <Trash2 className='h-3.5 w-3.5' />
          </Button>
        </div>
      )}
    </div>
  )
}

