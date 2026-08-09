'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
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
import type { ArchivedLead } from '@/lib/data/leads'
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { parseSortParam } from '@/lib/pagination/sort'
import { restoreLead, destroyLead } from '../_actions'
import { ARCHIVED_ROW_CLASS } from '@/lib/table/archived-row'

type LeadsArchiveSectionProps = {
  leads: ArchivedLead[]
}

// PRD 004 §03: per-view sort allowlist (D6). The table is in-memory, so the
// parsed `?sort=` drives a client-side sort of the fetched array.
const LEAD_ARCHIVE_SORT_FIELDS = ['name', 'archived'] as const

const DEFAULT_LEAD_ARCHIVE_SORT = {
  field: 'archived',
  direction: 'desc',
} as const

function isLeadStatus(value: string | undefined): value is LeadStatusValue {
  return (
    typeof value === 'string' &&
    (LEAD_STATUS_VALUES as readonly string[]).includes(value)
  )
}

function isLeadArchiveSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (LEAD_ARCHIVE_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

export function LeadsArchiveSection({ leads }: LeadsArchiveSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { update, getParam } = useListParams({
    basePath: '/leads/archive',
    resetKeys: [],
    filters: {
      status: { isValid: value => isLeadStatus(value) },
      q: {},
    },
  })
  const [isPending, startTransition] = useTransition()
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [destroyTarget, setDestroyTarget] = useState<ArchivedLead | null>(null)

  const handleRestore = (lead: ArchivedLead) => {
    setPendingRestoreId(lead.id)
    startTransition(async () => {
      const result = await restoreLead({ leadId: lead.id })
      setPendingRestoreId(null)

      if (!result.success) {
        toast({
          title: 'Failed to restore lead',
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

  const handleRequestDestroy = (lead: ArchivedLead) => {
    setDestroyTarget(lead)
  }

  const handleCancelDestroy = () => {
    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget) return

    const lead = destroyTarget
    setPendingDestroyId(lead.id)
    setDestroyTarget(null)

    startTransition(async () => {
      const result = await destroyLead({ leadId: lead.id })
      setPendingDestroyId(null)

      if (!result.success) {
        toast({
          title: 'Failed to delete lead',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Lead permanently deleted',
        description: `${lead.contactName} has been permanently removed.`,
      })
      router.refresh()
    })
  }

  const rawStatus = getParam('status')
  const statusFilter = isLeadStatus(rawStatus) ? rawStatus : undefined
  const searchQuery = getParam('q')?.trim() || undefined
  const rawSort = getParam('sort')
  const sortParam = rawSort && isLeadArchiveSortValue(rawSort) ? rawSort : undefined
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
      value => ({ value, label: LEAD_STATUS_LABELS[value] })
    )
  }, [leads])

  const visibleLeads = useMemo(() => {
    let filtered = statusFilter
      ? leads.filter(lead => lead.status === statusFilter)
      : leads
    // In-memory `?q=` search over the fields the table shows (PRD 004 §03).
    if (searchQuery) {
      const needle = searchQuery.toLowerCase()
      filtered = filtered.filter(lead =>
        [lead.contactName, lead.companyName, lead.contactEmail].some(field =>
          field?.toLowerCase().includes(needle)
        )
      )
    }
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

  if (leads.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
        No archived leads. Leads will appear here when archived from the board.
      </div>
    )
  }

  return (
    <>
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete lead?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.contactName} removes this lead and all associated data. This action cannot be undone.`
            : 'Permanently deleting this lead removes it. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <FilterBar>
        <SearchInput
          value={searchQuery}
          onCommit={value => update({ q: value })}
          placeholder='Search leads…'
        />
        <FilterSelect
          value={statusFilter}
          onChange={value => update({ status: value })}
          placeholder='All statuses'
          options={statusOptions}
        />
      </FilterBar>
      <div className='rounded-lg border'>
        <Table density='compact'>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <SortableTableHead
                field='name'
                sort={sortParam}
                defaultSort='archived:desc'
                onSortChange={next => update({ sort: next })}
                className='w-[30%]'
              >
                Contact
              </SortableTableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Last Status</TableHead>
              <SortableTableHead
                field='archived'
                sort={sortParam}
                defaultSort='archived:desc'
                onSortChange={next => update({ sort: next })}
              >
                Archived
              </SortableTableHead>
              <TableHead className='w-28 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLeads.map(lead => {
              const isRestoring = isPending && pendingRestoreId === lead.id
              const isDestroying = isPending && pendingDestroyId === lead.id
              const rowDisabled = isRestoring || isDestroying

              const statusLabel = lead.status
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())

              return (
                <TableRow key={lead.id} className={ARCHIVED_ROW_CLASS}>
                  <TableCell className='font-medium'>
                    {lead.contactName}
                  </TableCell>
                  <TableCell>
                    {lead.companyName ?? (
                      <span className='text-muted-foreground/40'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.contactEmail ? (
                      <span className='text-muted-foreground text-sm'>
                        {lead.contactEmail}
                      </span>
                    ) : (
                      <span className='text-muted-foreground/40'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className='text-muted-foreground text-sm'>
                      {statusLabel}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className='text-muted-foreground text-sm'>
                      {formatDistanceToNow(new Date(lead.deletedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <Button
                        variant='secondary'
                        size='icon-sm'
                        onClick={() => handleRestore(lead)}
                        disabled={rowDisabled}
                        title='Restore lead'
                        aria-label={`Restore ${lead.contactName}`}
                      >
                        <RefreshCw className='h-4 w-4' />
                        <span className='sr-only'>Restore</span>
                      </Button>
                      <Button
                        variant='destructive'
                        size='icon-sm'
                        onClick={() => handleRequestDestroy(lead)}
                        disabled={rowDisabled}
                        title='Permanently delete lead'
                        aria-label={`Permanently delete ${lead.contactName}`}
                      >
                        <Trash2 className='h-4 w-4' />
                        <span className='sr-only'>Delete permanently</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {visibleLeads.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  No archived leads match the current filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
