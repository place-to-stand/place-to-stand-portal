'use client'

import {
  Archive,
  Contact,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { ContactsTableContact } from '@/lib/settings/contacts/use-contacts-table-state'

import { LinkedClientsCell } from './linked-clients-cell'

export type ContactsTableSectionProps = {
  contacts: ContactsTableContact[]
  mode: 'active' | 'archive'
  onEdit: (contact: ContactsTableContact) => void
  onRequestDelete: (contact: ContactsTableContact) => void
  onRestore: (contact: ContactsTableContact) => void
  onRequestDestroy: (contact: ContactsTableContact) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  emptyMessage: string
}

export function ContactsTableSection({
  contacts,
  mode,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  emptyMessage,
}: ContactsTableSectionProps) {
  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Linked Clients</TableHead>
            <TableHead className='w-32 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map(contact => {
            const isDeleting = isPending && pendingDeleteId === contact.id
            const isRestoring = isPending && pendingRestoreId === contact.id
            const isDestroying = isPending && pendingDestroyId === contact.id

            const deleteDisabled =
              isDeleting ||
              isRestoring ||
              isDestroying ||
              Boolean(contact.deletedAt)
            const deleteDisabledReason = deleteDisabled
              ? isDeleting || isRestoring || isDestroying
                ? pendingReason
                : contact.deletedAt
                  ? 'Contact already archived.'
                  : null
              : null

            const restoreDisabled = isRestoring || isDeleting || isDestroying
            const restoreDisabledReason = restoreDisabled ? pendingReason : null

            const destroyDisabled =
              isDestroying || isDeleting || isRestoring || !contact.deletedAt
            const destroyDisabledReason = destroyDisabled
              ? !contact.deletedAt
                ? 'Archive the contact before permanently deleting.'
                : pendingReason
              : null

            const editDisabled = isDeleting || isRestoring || isDestroying
            const editDisabledReason = editDisabled ? pendingReason : null

            const showEdit = mode === 'active'
            const showSoftDelete = mode === 'active'
            const showRestore = mode === 'archive'
            const showDestroy = mode === 'archive'

            return (
              <TableRow
                key={contact.id}
                className={contact.deletedAt ? 'opacity-60' : undefined}
              >
                <TableCell>
                  <div className='flex items-center gap-2'>
                    <Contact className='h-4 w-4 text-cyan-500' />
                    <span className='font-medium'>{contact.name}</span>
                  </div>
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  <a
                    href={`mailto:${contact.email}`}
                    className='hover:text-foreground inline-flex items-center gap-1.5 transition'
                  >
                    <Mail className='h-3 w-3' />
                    {contact.email}
                  </a>
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className='hover:text-foreground inline-flex items-center gap-1.5 transition'
                    >
                      <Phone className='h-3 w-3' />
                      {contact.phone}
                    </a>
                  ) : (
                    <span className='text-muted-foreground/50'>—</span>
                  )}
                </TableCell>
                <TableCell className='text-sm'>
                  <LinkedClientsCell clients={contact.metrics.clients} />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    {showEdit ? (
                      <DisabledFieldTooltip
                        disabled={editDisabled}
                        reason={editDisabledReason}
                      >
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => onEdit(contact)}
                          title='Edit contact'
                          disabled={editDisabled}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showRestore ? (
                      <DisabledFieldTooltip
                        disabled={restoreDisabled}
                        reason={restoreDisabledReason}
                      >
                        <Button
                          variant='secondary'
                          size='icon'
                          onClick={() => onRestore(contact)}
                          title='Restore contact'
                          aria-label='Restore contact'
                          disabled={restoreDisabled}
                        >
                          <RefreshCw className='h-4 w-4' />
                          <span className='sr-only'>Restore</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showSoftDelete ? (
                      <DisabledFieldTooltip
                        disabled={deleteDisabled}
                        reason={deleteDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDelete(contact)}
                          title='Archive contact'
                          aria-label='Archive contact'
                          disabled={deleteDisabled}
                        >
                          <Archive className='h-4 w-4' />
                          <span className='sr-only'>Archive</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                    {showDestroy ? (
                      <DisabledFieldTooltip
                        disabled={destroyDisabled}
                        reason={destroyDisabledReason}
                      >
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => onRequestDestroy(contact)}
                          title='Permanently delete contact'
                          aria-label='Permanently delete contact'
                          disabled={destroyDisabled}
                        >
                          <Trash2 className='h-4 w-4' />
                          <span className='sr-only'>Delete permanently</span>
                        </Button>
                      </DisabledFieldTooltip>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className='text-muted-foreground py-10 text-center text-sm'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
