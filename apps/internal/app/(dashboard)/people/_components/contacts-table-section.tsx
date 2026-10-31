'use client'

import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'

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

import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'

import { CompanyBillingMark } from '@/components/billing/company-billing-mark'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { canSeePortalAccess } from '@/lib/settings/contacts/portal-visibility'
import { cn } from '@/lib/utils'
import { companySheetHref } from '@/lib/sheets/hrefs'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import { TruncationTooltip } from '@/components/ui/truncation-tooltip'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Badge } from '@pts/ui/badge'
import { ROLE_LABELS } from '@/lib/auth/roles'

export type ContactsTableSectionProps = {
  contacts: ContactsTableContact[]
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
            <SortableTableHead
              field='companies'
              sort={sort}
              defaultSort='name:asc'
              onSortChange={next => update({ sort: next })}
              className='w-[26%]'
            >
              Companies
            </SortableTableHead>
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
            {seesAccess ? (
              <SortableTableHead
                field='signIn'
                sort={sort}
                defaultSort='name:asc'
                onSortChange={next => update({ sort: next })}
                className='w-28'
                align='center'
              >
                Sign-in
              </SortableTableHead>
            ) : null}
            <TableHead className='w-32 text-right'>Actions</TableHead>
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
            const restoreDisabledReason = restoreDisabled ? pendingReason : null

            const showSoftDelete = mode === 'active'
            const showRestore = mode === 'archive'
            // Portal preview is admin-only.
            const showPreview = isAdmin && mode === 'active'

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
                    <UserAvatar
                      contactId={contact.id}
                      name={contact.name}
                      hasPhoto={Boolean(contact.userHasPhoto)}
                      size='xs'
                      alt=''
                    />
                    <span className='truncate font-medium' title={contact.name}>
                      {contact.name}
                    </span>
                  </div>
                </TableCell>
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
                        <Link
                          href={companySheetHref(contact.companyId)}
                          className='hover:text-foreground truncate-link min-w-0 underline-offset-4 transition hover:underline'
                        >
                          {contact.companyName}
                        </Link>
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
                            href: companySheetHref(company.id),
                            trailing: <CompanyClientMark company={company} />,
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
                {seesAccess ? (
                  <TableCell label='Sign-in' className='text-sm md:text-center'>
                    {contact.signInRole ? (
                      <Badge variant='outline'>
                        {ROLE_LABELS[contact.signInRole]}
                      </Badge>
                    ) : (
                      <EmptyValue />
                    )}
                  </TableCell>
                ) : null}
                <TableCell className='text-right max-md:ml-auto'>
                  <RecordRowActions>
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
                        entity='person'
                        onClick={() => onRestore(contact)}
                        disabled={restoreDisabled}
                        disabledReason={restoreDisabledReason}
                      />
                    ) : null}
                    {showSoftDelete ? (
                      <RecordRowAction
                        kind='archive'
                        entity='person'
                        onClick={() => onRequestDelete(contact)}
                        disabled={deleteDisabled}
                        disabledReason={deleteDisabledReason}
                      />
                    ) : null}
                  </RecordRowActions>
                </TableCell>
              </TableRow>
            )
          })}
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={seesAccess ? 6 : 5} className='p-4'>
                <EmptyState message={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

/** A company billed now, beside its name: `CompanyBillingMark`. */
function CompanyClientMark({
  company,
  className,
}: {
  company:
    { isClient: boolean; billingType: 'prepaid' | 'net_30' | null } | undefined
  className?: string
}) {
  if (!company?.isClient) return null
  return (
    <CompanyBillingMark
      billingType={company.billingType}
      className={className}
    />
  )
}
