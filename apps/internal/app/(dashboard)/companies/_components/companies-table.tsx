'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Star } from 'lucide-react'

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
import { contactSheetHref, leadHref } from '@/lib/sheets/hrefs'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import { useListParams } from '@/hooks/use-list-params'
import { useToast } from '@/components/ui/use-toast'
import type { CompanyListItem } from '@/lib/companies/types'
import { displayWebsiteHost, toWebsiteHref } from '@/lib/companies/website'
import { archiveCompanyDescription } from '../_lib/archive-copy'
import { archiveCompany, restoreCompany } from '../actions'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { cn } from '@/lib/utils'
import { ClientBadge } from '@/components/clients/client-badge'
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
        className='md:min-w-[60rem]'
      >
        <TableHeader>
          <TableRow className='bg-muted/40'>
            {sortHead('name', 'Company', 'w-[36%]')}
            <TableHead className='w-[24%]'>Website</TableHead>
            <TableHead className='w-[12%] text-center'>Client</TableHead>
            {sortHead('people', 'People', 'w-[12%]', 'center')}
            {sortHead('leads', 'Open leads', 'w-[12%]', 'center')}
            <TableHead className='w-16 text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map(company => {
            const host = displayWebsiteHost(company.website)
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
                <TableCell
                  label='Website'
                  className='text-muted-foreground truncate text-sm'
                  title={host ?? undefined}
                >
                  {host && company.website ? (
                    // Opens the site; the row ignores clicks on links.
                    <a
                      href={toWebsiteHref(company.website)}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='group/link hover:text-foreground inline-flex max-w-full items-center gap-1 underline-offset-4 transition hover:underline'
                    >
                      <span className='truncate'>{host}</span>
                      <ExternalLink className='size-3 shrink-0 opacity-0 transition group-hover/link:opacity-100' />
                    </a>
                  ) : (
                    <EmptyValue />
                  )}
                </TableCell>
                <TableCell label='Client' className='text-sm md:text-center'
                >
                  {company.clientId ? <ClientBadge /> : <EmptyValue />}
                </TableCell>
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
                <TableCell className='text-right max-md:ml-auto'>
                  <RecordRowActions>
                    {mode === 'active' ? (
                      <RecordRowAction
                        kind='archive'
                        entity='company'
                        disabled={isPending && pendingId === company.id}
                        onClick={() => setArchiveTarget(company)}
                      />
                    ) : (
                      <RecordRowAction
                        kind='restore'
                        entity='company'
                        disabled={isPending && pendingId === company.id}
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
              <TableCell colSpan={8} className='p-4'>
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
          archiveTarget?.clientName
        )}
        confirmLabel='Archive'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && runAction(archiveTarget, 'archive')}
      />
    </div>
  )
}
