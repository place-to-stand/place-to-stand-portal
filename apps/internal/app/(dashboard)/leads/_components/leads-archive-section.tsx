'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { formatRelativeTime } from '@pts/ui/dates'
import { EmptyState } from '@pts/ui/empty-state'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { EmptyValue } from '@/components/table/empty-value'
import {
  RecordRowAction,
  RecordRowActions,
} from '@/components/table/record-row-action'
import { FilterBar } from '@/components/table-toolbar/filter-bar'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { SearchInput } from '@/components/table-toolbar/search-input'
import { SortableTableHead } from '@/components/table-toolbar/sortable-table-head'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useListParams } from '@/hooks/use-list-params'
import { useSheetParamSelection } from '@/lib/sheets/use-sheet-params'
import type { ArchivedLead } from '@/lib/data/leads'
import type { LeadAssigneeOption } from '@/lib/leads/types'
import {
  getLeadStatusToken,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
} from '@/lib/leads/constants'
import { parseSortParam } from '@/lib/pagination/sort'
import { restoreLead } from '../_actions'
import { filterArchivedLeads, isLeadStatus } from '../_lib/archive-filters'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'
import {
  CLICKABLE_ROW_CLASS,
  getClickableRowProps,
} from '@/lib/table/clickable-row'
import { cn } from '@/lib/utils'
import { LeadSheet } from './lead-sheet'

type LeadsArchiveSectionProps = {
  leads: ArchivedLead[]
  assignees: LeadAssigneeOption[]
  senderName: string
  /** True when the `?lead=` share link points at a lead that no longer exists. */
  leadNotFound?: boolean
}

// PRD 004 §03: per-view sort allowlist (D6). The table is in-memory, so the
// parsed `?sort=` drives a client-side sort of the fetched array.
const LEAD_ARCHIVE_SORT_FIELDS = ['name', 'archived'] as const

const DEFAULT_LEAD_ARCHIVE_SORT = {
  field: 'archived',
  direction: 'desc',
} as const

function isLeadArchiveSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (LEAD_ARCHIVE_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

export function LeadsArchiveSection({
  leads,
  assignees,
  senderName,
  leadNotFound = false,
}: LeadsArchiveSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { update, getParam, hasActiveFilters, reset } = useListParams({
    basePath: '/leads/archive',
    resetKeys: [],
    filters: {
      status: { isValid: value => isLeadStatus(value) },
      q: {},
    },
  })
  const [isPending, startTransition] = useTransition()
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  // `?lead=` drives selection so archived leads are deep-linkable too.
  const { selectedId, select, clear } = useSheetParamSelection('lead')

  // Re-resolve from fresh props so the sheet reflects server refreshes.
  const selectedLead = selectedId
    ? (leads.find(lead => lead.id === selectedId) ?? null)
    : null

  // Keep the last-selected lead rendered after close so the sheet's exit
  // animation can play; only `open` toggles.
  const [lastOpenedLead, setLastOpenedLead] = useState<ArchivedLead | null>(
    null
  )
  if (selectedLead && selectedLead !== lastOpenedLead) {
    setLastOpenedLead(selectedLead)
  }
  const sheetOpen = Boolean(selectedLead)
  const sheetLead = selectedLead ?? lastOpenedLead

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      clear()
    }
  }

  const handleSheetSuccess = () => {
    clear()
    router.refresh()
  }

  const handleRestore = (lead: ArchivedLead) => {
    setPendingRestoreId(lead.id)
    startTransition(async () => {
      const result = await restoreLead({ leadId: lead.id })
      setPendingRestoreId(null)

      if (!result.success) {
        toast({
          title: 'Unable to restore lead',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Lead restored',
        description: `${lead.contactName} has been restored to the board.`,
      })
      router.refresh()
    })
  }

  const rawStatus = getParam('status')
  const statusFilter = isLeadStatus(rawStatus) ? rawStatus : undefined
  const searchQuery = getParam('q')?.trim() || undefined
  const rawSort = getParam('sort')
  const sortParam =
    rawSort && isLeadArchiveSortValue(rawSort) ? rawSort : undefined
  const sort = parseSortParam(
    sortParam,
    LEAD_ARCHIVE_SORT_FIELDS,
    DEFAULT_LEAD_ARCHIVE_SORT
  )

  // Only offer statuses actually present in the archive — leads keep their
  // last board status when archived, so any status can appear here.
  const statusOptions = useMemo(() => {
    const present = new Set(leads.map(lead => lead.status))
    return LEAD_STATUS_VALUES.filter(value => present.has(value)).map(
      value => ({
        value,
        label: LEAD_STATUS_LABELS[value],
        // The list's Last status badge.
        badgeClassName: getLeadStatusToken(value),
      })
    )
  }, [leads])

  const visibleLeads = useMemo(() => {
    const filtered = filterArchivedLeads(leads, {
      status: statusFilter,
      q: searchQuery,
    })
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sort.field === 'name') {
        return (
          factor *
          a.contactName.localeCompare(b.contactName, undefined, {
            sensitivity: 'base',
          })
        )
      }
      return factor * a.deletedAt.localeCompare(b.deletedAt)
    })
  }, [leads, searchQuery, sort.direction, sort.field, statusFilter])

  const emptyMessage =
    leads.length === 0
      ? 'No archived leads.'
      : 'No leads match the current filters.'

  return (
    <>
      {leadNotFound ? (
        <DeepLinkNotFoundNotice entity='lead' onDismiss={clear} />
      ) : null}
      {sheetLead ? (
        <LeadSheet
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          lead={sheetLead}
          assignees={assignees}
          canManage
          senderName={senderName}
          onSuccess={handleSheetSuccess}
        />
      ) : null}
      <FilterBar
        search={
          <SearchInput
            value={searchQuery}
            onCommit={value => update({ q: value })}
            placeholder='Search leads…'
          />
        }
        activeFilterCount={statusFilter ? 1 : 0}
        showReset={hasActiveFilters}
        onReset={reset}
      >
        <FilterSelect
          value={statusFilter}
          onChange={value => update({ status: value })}
          placeholder='All statuses'
          options={statusOptions}
        />
      </FilterBar>
      <div className='overflow-hidden rounded-lg border'>
        <Table
          density='compact'
          layout='fixed'
          stack
          className='md:min-w-[46rem]'
        >
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sortParam}
                defaultSort='archived:desc'
                onSortChange={next => update({ sort: next })}
                className='w-[20%]'
              >
                Person
              </SortableTableHead>
              <TableHead className='w-[16%]'>Company</TableHead>
              <TableHead className='w-[18%]'>Email</TableHead>
              <TableHead className='w-[20%]'>Last status</TableHead>
              <SortableTableHead
                field='archived'
                sort={sortParam}
                defaultSort='archived:desc'
                onSortChange={next => update({ sort: next })}
                className='w-[14%]'
              >
                Archived
              </SortableTableHead>
              <TableHead className='w-24 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLeads.map(lead => {
              const isRestoring = isPending && pendingRestoreId === lead.id

              return (
                <TableRow
                  key={lead.id}
                  {...getClickableRowProps(() => {
                    select(lead.id)
                  })}
                  className={cn(CLICKABLE_ROW_CLASS, ARCHIVED_ROW_CLASS)}
                >
                  <TableCell
                    className='truncate font-medium'
                    title={lead.contactName}
                  >
                    {lead.contactName}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'truncate',
                      !lead.companyName && 'max-md:hidden'
                    )}
                    title={lead.companyName ?? undefined}
                  >
                    {lead.companyName ?? <EmptyValue />}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'truncate',
                      !lead.contactEmail && 'max-md:hidden'
                    )}
                    title={lead.contactEmail ?? undefined}
                  >
                    {lead.contactEmail ? (
                      <span className='text-muted-foreground text-sm'>
                        {lead.contactEmail}
                      </span>
                    ) : (
                      <EmptyValue />
                    )}
                  </TableCell>
                  <TableCell label='Last status'>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell label='Archived'>
                    <span className='text-muted-foreground text-sm'>
                      {formatRelativeTime(lead.deletedAt)}
                    </span>
                  </TableCell>
                  <TableCell className='text-right max-md:ml-auto'>
                    <RecordRowActions>
                      <RecordRowAction
                        kind='restore'
                        entity='lead'
                        onClick={() => handleRestore(lead)}
                        disabled={isRestoring}
                      />
                    </RecordRowActions>
                  </TableCell>
                </TableRow>
              )
            })}
            {visibleLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='p-4'>
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
