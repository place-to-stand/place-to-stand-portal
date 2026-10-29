'use client'

import { Contact, Mail, Phone } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { EmptyValue } from '@/components/table/empty-value'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { isContactSortValue } from '@/lib/settings/contacts/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'

import type { ContactsTableContact } from '@/lib/settings/contacts/use-contacts-table-state'

import { LinkedClientsCell } from './linked-clients-cell'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { cn } from '@/lib/utils'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'

export type ContactsTableSectionProps = {
  contacts: ContactsTableContact[]
  mode: 'active' | 'archive'
  onEdit: (contact: ContactsTableContact) => void
  onRequestDelete: (contact: ContactsTableContact) => void
  onRestore: (contact: ContactsTableContact) => void
  onRequestDestroy: (contact: ContactsTableContact) => void
  onRequestPromote: (contact: ContactsTableContact) => void
  onRequestPreview: (contact: ContactsTableContact) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  pendingDestroyId: string | null
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

export function ContactsTableSection({
  contacts,
  mode,
  basePath,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestDestroy,
  onRequestPromote,
  onRequestPreview,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  pendingDestroyId,
  emptyMessage,
}: ContactsTableSectionProps) {
  const { isAdmin } = useViewerAccess()
  // Contacts tables paginate by offset — `page` is the pagination key
  // cleared on sort changes (not cursor/dir).
  const { update, getParam } = useListParams({
    basePath,
    resetKeys: ['page'],
  })
  const rawSort = getParam('sort')
  const sort = rawSort && isContactSortValue(rawSort) ? rawSort : undefined

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table
        density='compact'
        layout='fixed'
        stack
        className='md:min-w-[50rem]'
      >
        <TableHeader>
          <TableRow className='bg-muted/40'>
            <SortableTableHead
              field='name'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-[22%]'
            >
              Name
            </SortableTableHead>
            <TableHead className='w-[18%]'>Company</TableHead>
            <SortableTableHead
              field='email'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-[22%]'
            >
              Email
            </SortableTableHead>
            <SortableTableHead
              field='phone'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-40'
            >
              Phone
            </SortableTableHead>
            <SortableTableHead
              field='clients'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-24'
              align='center'
            >
              Clients
            </SortableTableHead>
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

            const showSoftDelete = mode === 'active'
            const showRestore = mode === 'archive'
            // Hard delete, portal preview and portal accounts are admin-only.
            const showDestroy = isAdmin && mode === 'archive'
            const showPreview = isAdmin && mode === 'active'
            const showPromote = isAdmin && mode === 'active' && !contact.userId

            const promoteDisabled = isDeleting || isRestoring || isDestroying
            const promoteDisabledReason = promoteDisabled ? pendingReason : null

            return (
              <TableRow
                key={contact.id}
                {...getClickableRowProps(() => onEdit(contact))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  contact.deletedAt && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2'>
                    <Contact className='h-4 w-4 shrink-0 text-cyan-500' />
                    <span className='truncate font-medium' title={contact.name}>
                      {contact.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  label='Company'
                  className='truncate text-sm'
                  title={contact.companyName ?? undefined}
                >
                  {contact.companyName ?? <EmptyValue />}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      title={contact.email}
                      className='hover:text-foreground inline-flex max-w-full items-center gap-1.5 transition'
                    >
                      <Mail className='h-3 w-3 shrink-0' />
                      <span className='truncate'>{contact.email}</span>
                    </a>
                  ) : (
                    <EmptyValue />
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-muted-foreground truncate text-sm whitespace-nowrap',
                    !contact.phone && 'max-md:hidden'
                  )}
                  title={contact.phone ?? undefined}
                >
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className='hover:text-foreground inline-flex items-center gap-1.5 transition'
                    >
                      <Phone className='h-3 w-3' />
                      {contact.phone}
                    </a>
                  ) : (
                    <EmptyValue />
                  )}
                </TableCell>
                <TableCell label='Clients' className='text-sm md:text-center'>
                  <LinkedClientsCell clients={contact.metrics.clients} />
                </TableCell>
                <TableCell className='text-right max-md:ml-auto'>
                  <RecordRowActions>
                    {/* Promote renders first: it's conditional, so keeping
                        Preview adjacent to Archive holds the eye icon to one
                        column across rows. */}
                    {showPromote ? (
                      <RecordRowAction
                        kind='promote'
                        onClick={() => onRequestPromote(contact)}
                        disabled={promoteDisabled}
                        disabledReason={promoteDisabledReason}
                      />
                    ) : null}
                    {showPreview ? (
                      <RecordRowAction
                        kind='preview'
                        onClick={() => onRequestPreview(contact)}
                        disabled={isPending}
                        disabledReason={isPending ? pendingReason : null}
                      />
                    ) : null}
                    {showRestore ? (
                      <RecordRowAction
                        kind='restore'
                        entity='contact'
                        onClick={() => onRestore(contact)}
                        disabled={restoreDisabled}
                        disabledReason={restoreDisabledReason}
                      />
                    ) : null}
                    {showSoftDelete ? (
                      <RecordRowAction
                        kind='archive'
                        entity='contact'
                        onClick={() => onRequestDelete(contact)}
                        disabled={deleteDisabled}
                        disabledReason={deleteDisabledReason}
                      />
                    ) : null}
                    {showDestroy ? (
                      <RecordRowAction
                        kind='destroy'
                        entity='contact'
                        onClick={() => onRequestDestroy(contact)}
                        disabled={destroyDisabled}
                        disabledReason={destroyDisabledReason}
                      />
                    ) : null}
                  </RecordRowActions>
                </TableCell>
              </TableRow>
            )
          })}
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className='p-4'>
                <EmptyState message={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
