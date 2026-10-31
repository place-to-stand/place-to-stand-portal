'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Star } from 'lucide-react'

import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { EmptyState } from '@pts/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { EmptyValue } from '@/components/table/empty-value'
import { LinkedRecordsHoverCell } from '@/components/ui/linked-records-hover-cell'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import {
  contactSheetHref,
  leadHref,
  projectBoardHref,
} from '@/lib/sheets/hrefs'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { useToast } from '@/components/ui/use-toast'
import type { CompanyListItem } from '@/lib/companies/types'
import { archiveCompanyDescription } from '../_lib/archive-copy'
import { archiveCompany, restoreCompany } from '../actions'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { cn } from '@/lib/utils'
import { formatHours } from '@pts/ui/numbers'
import { BALANCE_TONE_CLASS, balanceTone } from '@/lib/billing/balance-tone'
import { BillingTypeBadge } from '@/components/billing/billing-type-badge'
import { PersonAvatar } from '@/components/ui/user-avatar'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'

export function CompaniesTable({
  companies,
  emptyMessage,
  sort,
  basePath,
  mode,
}: {
  companies: CompanyListItem[]
  emptyMessage: string
  /** Validated `?sort=`, or undefined for the default (name A–Z). */
  sort: string | undefined
  basePath: string
  mode: 'active' | 'archive'
}) {
  const { open } = useSheetParams()
  // Billing and commission columns are for people who manage clients.
  const { isAdmin: seesBilling } = useViewerAccess()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<CompanyListItem | null>(
    null
  )

  const runAction = (
    company: CompanyListItem,
    action: 'archive' | 'restore'
  ) => {
    setPendingId(company.id)
    startTransition(async () => {
      const result =
        action === 'archive'
          ? await archiveCompany(company.id)
          : await restoreCompany(company.id)
      setPendingId(null)
      setArchiveTarget(null)
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: `Unable to ${action} company`,
          description: result.error,
        })
        return
      }
      toast({
        title: action === 'archive' ? 'Company archived' : 'Company restored',
        description: company.name,
      })
      router.refresh()
    })
  }
  const { update } = useListParams({ basePath, resetKeys: [] })
  const sortHead = (
    field: string,
    label: string,
    className: string,
    align?: 'center'
  ) => (
    <SortableTableHead
      field={field}
      sort={sort}
      defaultSort='name:asc'
      onSortChange={next => update({ sort: next })}
      className={className}
      align={align}
    >
      {label}
    </SortableTableHead>
  )

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table
        density='compact'
        layout='fixed'
        stack
        className='md:min-w-[72rem]'
      >
        <TableHeader>
          <TableRow className='bg-muted/40'>
            {sortHead('name', 'Company', 'w-[30%]')}
            {sortHead('client', 'Client', 'w-[11%]')}
            {seesBilling ? sortHead('hours', 'Hours', 'w-[18%]') : null}
            {sortHead('people', 'People', 'w-[7%]', 'center')}
            {sortHead('leads', 'Open leads', 'w-[9%]', 'center')}
            {sortHead('projects', 'Projects', 'w-[8%]', 'center')}
            {seesBilling ? (
              <>
                {sortHead('origination', 'Origination', 'w-[9%]', 'center')}
                {sortHead('closer', 'Closer', 'w-[7%]', 'center')}
              </>
            ) : null}
            <TableHead className='w-16 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map(company => {
            return (
              <TableRow
                key={company.id}
                {...getClickableRowProps(() => open('company', company.id))}
                className={cn(
                  CLICKABLE_ROW_CLASS,
                  company.deletedAt && ARCHIVED_ROW_CLASS
                )}
              >
                <TableCell>
                  <div className='flex min-w-0 items-center gap-2'>
                    <ENTITY_ICONS.company
                      className={cn(
                        ENTITY_ACCENTS.company.icon,
                        'h-4 w-4 shrink-0'
                      )}
                    />
                    <span className='truncate font-medium' title={company.name}>
                      {company.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell label='Client'>
                  {/* Billed now: its billing type (admins) or a check. A former
                      client gets the dash. */}
                  {company.companyId && seesBilling && company.billingType ? (
                    <BillingTypeBadge billingType={company.billingType} />
                  ) : company.companyId ? (
                    <Check
                      className={cn(
                        ENTITY_ACCENTS.client.icon,
                        'inline size-4'
                      )}
                      aria-label='Billed now'
                    />
                  ) : (
                    <EmptyValue />
                  )}
                </TableCell>
                {seesBilling ? (
                  <TableCell label='Hours' className='text-sm tabular-nums'>
                    {company.hours ? (
                      <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
                        <ENTITY_ICONS.timeLog
                          className={cn(
                            ENTITY_ACCENTS.timeLog.icon,
                            'size-4 shrink-0'
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            'font-medium',
                            BALANCE_TONE_CLASS[
                              balanceTone(company.hours.remaining)
                            ]
                          )}
                        >
                          {formatHours(company.hours.remaining)} left
                        </span>
                        <span className='text-muted-foreground'>
                          ({formatHours(company.hours.purchased)} total)
                        </span>
                      </span>
                    ) : (
                      <EmptyValue />
                    )}
                  </TableCell>
                ) : null}
                <TableCell
                  label='People'
                  className='text-sm tabular-nums md:text-center'
                >
                  <LinkedRecordsHoverCell
                    count={company.contactCount}
                    withIcon
                    icon={ENTITY_ICONS.contact}
                    iconClassName={ENTITY_ACCENTS.contact.icon}
                    ariaLabel={`${company.contactCount} ${company.contactCount === 1 ? 'person' : 'people'}`}
                    items={company.people.map(person => ({
                      id: person.id,
                      label: person.name,
                      sublabel: person.jobTitle ?? person.email,
                      href: contactSheetHref(person.id),
                      // The primary contact, starred as on the company sheet.
                      trailing: person.isPrimary ? (
                        <Star
                          className='text-warning size-3.5 shrink-0 fill-current'
                          aria-label='Primary contact'
                        />
                      ) : null,
                    }))}
                  />
                </TableCell>
                <TableCell
                  label='Open leads'
                  className='text-sm tabular-nums md:text-center'
                >
                  <LinkedRecordsHoverCell
                    count={company.openLeadCount}
                    withIcon
                    icon={ENTITY_ICONS.lead}
                    iconClassName={ENTITY_ACCENTS.lead.icon}
                    ariaLabel={`${company.openLeadCount} open ${company.openLeadCount === 1 ? 'lead' : 'leads'}`}
                    contentClassName='min-w-72'
                    items={company.openLeads.map(lead => ({
                      id: lead.id,
                      label: lead.contactName,
                      href: leadHref(lead.id),
                      trailing: <LeadStatusBadge status={lead.status} />,
                    }))}
                  />
                </TableCell>
                <TableCell
                  label='Projects'
                  className='text-sm tabular-nums md:text-center'
                >
                  <LinkedRecordsHoverCell
                    count={company.projects.length}
                    withIcon
                    icon={ENTITY_ICONS.project}
                    iconClassName={ENTITY_ACCENTS.project.icon}
                    ariaLabel={`${company.projects.length} ${company.projects.length === 1 ? 'project' : 'projects'}`}
                    items={company.projects.map(project => ({
                      id: project.id,
                      label: project.name,
                      href:
                        company.slug && project.slug
                          ? projectBoardHref(company.slug, project.slug)
                          : undefined,
                    }))}
                  />
                </TableCell>
                {seesBilling ? (
                  <>
                    <TableCell label='Origination' className='md:text-center'>
                      {company.origination ? (
                        <PersonAvatar
                          name={company.origination.name}
                          userId={company.origination.userId ?? undefined}
                          contactId={company.origination.contactId ?? undefined}
                          ariaLabel={`Originated by ${company.origination.name}`}
                        />
                      ) : (
                        <EmptyValue />
                      )}
                    </TableCell>
                    <TableCell label='Closer' className='md:text-center'>
                      {company.closers.length ? (
                        <span className='inline-flex -space-x-1.5 [&>span]:rounded-full [&>span]:ring-2 [&>span]:ring-[var(--card)]'>
                          {company.closers.map(closer => (
                            <PersonAvatar
                              key={`${closer.kind}:${closer.id}`}
                              name={closer.name}
                              userId={
                                closer.kind === 'user' ? closer.id : undefined
                              }
                              contactId={
                                closer.kind === 'contact'
                                  ? closer.id
                                  : undefined
                              }
                              ariaLabel={`Closed by ${closer.name}`}
                            />
                          ))}
                        </span>
                      ) : (
                        <EmptyValue />
                      )}
                    </TableCell>
                  </>
                ) : null}
                <TableCell className='text-right max-md:ml-auto'>
                  <RecordRowActions>
                    {mode === 'active' ? (
                      <RecordRowAction
                        kind='archive'
                        entity='company'
                        disabled={
                          Boolean(company.archiveRefusal) ||
                          (isPending && pendingId === company.id)
                        }
                        disabledReason={company.archiveRefusal}
                        onClick={() => setArchiveTarget(company)}
                      />
                    ) : (
                      <RecordRowAction
                        kind='restore'
                        entity='company'
                        disabled={
                          Boolean(company.archiveRefusal) ||
                          (isPending && pendingId === company.id)
                        }
                        disabledReason={company.archiveRefusal}
                        onClick={() => runAction(company, 'restore')}
                      />
                    )}
                  </RecordRowActions>
                </TableCell>
              </TableRow>
            )
          })}
          {companies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className='p-4'>
                <EmptyState message={emptyMessage} />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title='Archive company?'
        description={archiveCompanyDescription(
          archiveTarget?.name,
          Boolean(archiveTarget?.formerClient)
        )}
        confirmLabel='Archive company'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && runAction(archiveTarget, 'archive')}
      />
    </div>
  )
}
