'use client'

import { Mail, Phone } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { RecordContextMenu } from '@/components/table/record-context-menu'
import { EmptyValue } from '@/components/table/empty-value'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { isContactSortValue } from '@/lib/people/filters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'

import type { ContactsTableContact } from '@/lib/people/use-contacts-table-state'

import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'

import { ClientBadge } from '@/components/companies/client-badge'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { canSeePortalAccess } from '@/lib/people/portal-visibility'
import {
  canPreviewAsClient,
  PREVIEW_UNAVAILABLE_REASON,
} from '@/lib/people/portal-preview'
import { cn } from '@/lib/utils'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { TruncationTooltip } from '@/components/ui/truncation-tooltip'
import { UserAvatar } from '@/components/ui/user-avatar'
import { RoleBadge } from '@/components/auth/role-badge'
import {
  RowSelectionProvider,
  SelectAllHead,
  SelectRowCell,
  type RowSelection,
} from '@/components/table/bulk-select'
import { SheetLink } from '@/components/ui/sheet-link'

export type ContactsTableSectionProps = {
  contacts: ContactsTableContact[]
  selection: RowSelection
  mode: 'active' | 'archive'
  onEdit: (contact: ContactsTableContact) => void
  onRequestDelete: (contact: ContactsTableContact) => void
  onRestore: (contact: ContactsTableContact) => void
  onRequestPreview: (contact: ContactsTableContact) => void
  isPending: boolean
  pendingReason: string
  pendingDeleteId: string | null
  pendingRestoreId: string | null
  emptyMessage: string
  /** Route the sort/filter params live on (PRD 004 §03). */
  basePath: string
}

export function ContactsTableSection({
  contacts,
  selection,
  mode,
  basePath,
  onEdit,
  onRequestDelete,
  onRestore,
  onRequestPreview,
  isPending,
  pendingReason,
  pendingDeleteId,
  pendingRestoreId,
  emptyMessage,
}: ContactsTableSectionProps) {
  const { isAdmin, role } = useViewerAccess()
  // Sign-ins and portal access are for people who manage clients.
  const seesAccess = canSeePortalAccess(role)
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
      <RowSelectionProvider selection={selection} entity='contact'>
        <Table
          density='compact'
          layout='fixed'
          stack
          className='md:min-w-[56rem]'
        >
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SelectAllHead />
              <SortableTableHead
                field='name'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
              >
                Name
              </SortableTableHead>
              {seesAccess ? (
                <SortableTableHead
                  field='signIn'
                  sort={sort}
                  defaultSort='name:asc'
                  onSortChange={next => update({ sort: next })}
                  className='w-[9%]'
                >
                  Role
                </SortableTableHead>
              ) : null}
              <SortableTableHead
                field='companies'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[20%]'
              >
                Companies
              </SortableTableHead>
              <SortableTableHead
                field='email'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[18%]'
              >
                Email
              </SortableTableHead>
              <SortableTableHead
                field='phone'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-[15%]'
              >
                Phone
              </SortableTableHead>
              <TableHead className='w-20 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map(contact => {
              const isDeleting = isPending && pendingDeleteId === contact.id
              const isRestoring = isPending && pendingRestoreId === contact.id

              const deleteDisabled =
                isDeleting || isRestoring || Boolean(contact.deletedAt)
              const deleteDisabledReason = deleteDisabled
                ? isDeleting || isRestoring
                  ? pendingReason
                  : contact.deletedAt
                    ? 'Person already archived.'
                    : null
                : null

              const restoreDisabled = isRestoring || isDeleting
              const restoreDisabledReason = restoreDisabled
                ? pendingReason
                : null

              const showSoftDelete = mode === 'active'
              const showRestore = mode === 'archive'
              // Portal preview is admin-only.
              const showPreview = isAdmin && mode === 'active'
              const canPreview = canPreviewAsClient(contact)

              return (
                <RecordContextMenu
                  key={contact.id}
                  entity='contact'
                  id={contact.id}
                  onEdit={() => onEdit(contact)}
                  onArchive={
                    showSoftDelete ? () => onRequestDelete(contact) : undefined
                  }
                  onRestore={showRestore ? () => onRestore(contact) : undefined}
                  archiveDisabledReason={
                    showRestore ? restoreDisabledReason : deleteDisabledReason
                  }
                >
                  <TableRow
                    {...getClickableRowProps(() => onEdit(contact))}
                    data-selected={
                      selection.isSelected(contact.id) || undefined
                    }
                    className={cn(
                      CLICKABLE_ROW_CLASS,
                      contact.deletedAt && ARCHIVED_ROW_CLASS
                    )}
                  >
                    <SelectRowCell id={contact.id} label={contact.name} />
                    <TableCell>
                      <div className='flex min-w-0 items-center gap-2'>
                        <UserAvatar
                          contactId={contact.id}
                          name={contact.name}
                          hasPhoto={Boolean(contact.userHasPhoto)}
                          size='xs'
                          alt=''
                        />
                        <span
                          className='truncate font-medium'
                          title={contact.name}
                        >
                          {contact.name}
                        </span>
                      </div>
                    </TableCell>
                    {seesAccess ? (
                      <TableCell label='Role' className='text-sm'>
                        {contact.signInRole ? (
                          <RoleBadge role={contact.signInRole} />
                        ) : (
                          <EmptyValue />
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell label='Companies' className='text-sm'>
                      {contact.companyId && contact.companyName ? (
                        <span className='flex min-w-0 items-center gap-2'>
                          <ENTITY_ICONS.company
                            className={cn(
                              ENTITY_ACCENTS.company.icon,
                              'h-4 w-4 shrink-0'
                            )}
                          />
                          {/* The row ignores clicks on links, so this opens the
                          company, not the contact. */}
                          {/* Names only get a tooltip when they're cut off. */}
                          <TruncationTooltip content={contact.companyName}>
                            <SheetLink
                              sheet={{
                                entity: 'company',
                                id: contact.companyId,
                              }}
                            >
                              {contact.companyName}
                            </SheetLink>
                          </TruncationTooltip>
                          <CompanyClientMark
                            company={contact.companies.find(
                              company => company.id === contact.companyId
                            )}
                            className='shrink-0'
                          />
                          {contact.companies.length > 1 ? (
                            <LinkedRecordsHoverCell
                              count={contact.companies.length}
                              triggerLabel={`+${contact.companies.length - 1}`}
                              triggerClassName='text-muted-foreground shrink-0'
                              icon={ENTITY_ICONS.company}
                              iconClassName={ENTITY_ACCENTS.company.icon}
                              ariaLabel={`${contact.companies.length} companies`}
                              items={contact.companies.map(company => ({
                                id: company.id,
                                label: company.name,
                                sheet: { entity: 'company', id: company.id },
                                trailing: (
                                  <CompanyClientMark company={company} />
                                ),
                              }))}
                            />
                          ) : null}
                        </span>
                      ) : (
                        <EmptyValue />
                      )}
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
                    <TableCell className='text-right max-md:ml-auto'>
                      <RecordRowActions>
                        {showPreview ? (
                          <RecordRowAction
                            kind='preview'
                            onClick={() => onRequestPreview(contact)}
                            disabled={isPending || !canPreview}
                            disabledReason={
                              isPending
                                ? pendingReason
                                : canPreview
                                  ? null
                                  : PREVIEW_UNAVAILABLE_REASON
                            }
                          />
                        ) : null}
                        {showRestore ? (
                          <RecordRowAction
                            kind='restore'
                            entity='person'
                            onClick={() => onRestore(contact)}
                            disabled={restoreDisabled}
                            disabledReason={restoreDisabledReason}
                          />
                        ) : null}
                      </RecordRowActions>
                    </TableCell>
                  </TableRow>
                </RecordContextMenu>
              )
            })}
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={seesAccess ? 7 : 6} className='p-4'>
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </RowSelectionProvider>
    </div>
  )
}

/** A company billed now, beside its name: the Client badge (everyone). */
function CompanyClientMark({
  company,
  className,
}: {
  company: { isClient: boolean } | undefined
  className?: string
}) {
  if (!company?.isClient) return null
  return <ClientBadge className={className} />
}
