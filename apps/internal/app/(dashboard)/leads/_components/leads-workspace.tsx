'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { PersonSelector } from '@/components/my-tasks/person-selector'
import { FilterSheetButton } from '@/components/table-toolbar/filter-sheet'
import {
  useSheetParamSelection,
} from '@/lib/sheets/use-sheet-params'
import type { LeadAssigneeOption, LeadBoardColumnData } from '@/lib/leads/types'
import type { LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'

import { LEADS_TABS } from '../_lib/tabs'
import { LeadsBoard } from './leads-board'
import { LeadSheet } from './lead-sheet'

type LeadsWorkspaceProps = {
  initialColumns: LeadBoardColumnData[]
  assignees: LeadAssigneeOption[]
  canManage: boolean
  senderName?: string
  /** True when the `?lead=` share link points at a lead that no longer exists. */
  leadNotFound?: boolean
  /** A user id (only their leads) or `'all'`. */
  assigneeFilter?: string
  viewerId: string
  /** `leads.convert`: dropping into Closed Won offers conversion. */
}

export function LeadsWorkspace({
  initialColumns,
  assignees,
  canManage,
  senderName,
  leadNotFound = false,
  assigneeFilter = 'all',
  viewerId,
}: LeadsWorkspaceProps) {
  const router = useRouter()
  // The `?lead=` param drives the sheet: uuid = edit, `new` = create. Local
  // selection state opens the sheet instantly while the URL catches up.
  const { selectedId, isCreating, select, openCreate, clear } =
    useSheetParamSelection('lead')
  const [initialStatus, setInitialStatus] = useState<LeadStatusValue | null>(
    null
  )
  const [, startRefresh] = useTransition()
  // The sheet opens any lead on the board, filtered out or not.
  const leadLookup = useMemo(
    () => buildLeadLookup(initialColumns),
    [initialColumns]
  )
  const { visibleColumns, hiddenLeads } = useMemo(
    () =>
      splitByAssignee(
        initialColumns,
        assigneeFilter === 'all' ? null : assigneeFilter
      ),
    [initialColumns, assigneeFilter]
  )
  // Lead owners (Admin and Sales), in the picker's user shape.
  const pickerPeople = useMemo(
    () =>
      assignees.map(person => ({
        id: person.id,
        full_name: person.name,
        email: person.email ?? '',
        avatar_url: person.avatarUrl,
        disabled_at: person.disabledAt,
        deleted_at: null,
      })),
    [assignees]
  )
  const totalLeads = useMemo(
    () => visibleColumns.reduce((sum, column) => sum + column.leads.length, 0),
    [visibleColumns]
  )
  const activeLead = selectedId ? (leadLookup.get(selectedId) ?? null) : null

  const handleCreateLead = useCallback(
    (status?: LeadStatusValue) => {
      if (!canManage) {
        return
      }

      setInitialStatus(status ?? null)
      openCreate()
    },
    [canManage, openCreate]
  )

  const handleEditLead = useCallback(
    (lead: LeadRecord) => {
      if (!canManage) {
        return
      }

      setInitialStatus(null)
      select(lead.id)
    },
    [canManage, select]
  )

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        return
      }

      setInitialStatus(null)
      clear()
      startRefresh(() => {
        router.refresh()
      })
    },
    [clear, router, startRefresh]
  )

  const handleSheetSuccess = useCallback(() => {
    startRefresh(() => {
      router.refresh()
    })
  }, [router, startRefresh])


  const isSheetOpen = canManage && (isCreating || Boolean(activeLead))
  // Keep the last-opened lead rendered while the close animation plays so
  // the sheet doesn't flip to create mode (narrower layout) mid-exit.
  const [lastOpenedLead, setLastOpenedLead] = useState<LeadRecord | null>(null)
  if (activeLead && activeLead !== lastOpenedLead) {
    setLastOpenedLead(activeLead)
  }
  const sheetLead = isCreating ? null : (activeLead ?? lastOpenedLead)
  const boardActiveLeadId = isSheetOpen && sheetLead ? sheetLead.id : null

  // The same person picker as My tasks; it writes `?assignee=`.
  const assigneePicker = (
    <PersonSelector
      admins={pickerPeople}
      selectedUserId={assigneeFilter}
      currentUserId={viewerId}
      allLabel='All leads'
    />
  )

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/leads')}
      tabs={LEADS_TABS}
      activeTab='board'
      count={{ label: 'leads', total: totalLeads }}
      primaryAction={
        // Same toolbar as My tasks: the filter sits beside Create, and moves
        // into a slide-out below md.
        <div className='flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap'>
          <FilterSheetButton
            className='md:hidden'
            activeCount={assigneeFilter === 'all' ? 0 : 1}
          >
            {assigneePicker}
          </FilterSheetButton>
          <div className='max-md:hidden md:contents'>{assigneePicker}</div>
          <SheetCreateButton
            entity='lead'
            label='Create lead'
            disabledReason={
              canManage ? null : 'Admin access is required to create leads.'
            }
          />
        </div>
      }
      // Kanban board: pin to the viewport (columns scroll internally).
      contentClassName='flex h-full min-h-0 flex-col gap-4 sm:gap-6'
    >
      {leadNotFound && !isCreating ? (
        <DeepLinkNotFoundNotice entity='lead' onDismiss={clear} />
      ) : null}
      {canManage ? (
        <LeadSheet
          open={isSheetOpen}
          onOpenChange={handleSheetOpenChange}
          lead={sheetLead}
          initialStatus={initialStatus}
          assignees={assignees}
          canManage={canManage}
          senderName={senderName}
          onSuccess={handleSheetSuccess}
        />
      ) : null}
      <LeadsBoard
        initialColumns={visibleColumns}
        hiddenLeads={hiddenLeads}
        canManage={canManage}
        onEditLead={handleEditLead}
        onCreateLead={handleCreateLead}
        activeLeadId={boardActiveLeadId}
      />
    </PageShell>
  )
}

/**
 * The columns to show, and the leads a filter hides (which still count when
 * a drag works out a rank, so a reorder lands where it looks like it does).
 */
function splitByAssignee(
  columns: LeadBoardColumnData[],
  assigneeId: string | null
) {
  if (!assigneeId) {
    return { visibleColumns: columns, hiddenLeads: [] as LeadRecord[] }
  }
  const hiddenLeads: LeadRecord[] = []
  const visibleColumns = columns.map(column => ({
    ...column,
    leads: column.leads.filter(lead => {
      if (lead.assigneeId === assigneeId) return true
      hiddenLeads.push(lead)
      return false
    }),
  }))
  return { visibleColumns, hiddenLeads }
}

function buildLeadLookup(columns: LeadBoardColumnData[]) {
  const map = new Map<string, LeadRecord>()

  columns.forEach(column => {
    column.leads.forEach(lead => {
      map.set(lead.id, lead)
    })
  })

  return map
}
