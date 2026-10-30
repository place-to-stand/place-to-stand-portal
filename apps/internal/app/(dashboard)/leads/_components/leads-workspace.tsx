'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { FilterSelect } from '@/components/table-toolbar/filter-select'
import { FilterSheetButton } from '@/components/table-toolbar/filter-sheet'
import { useListParams } from '@/hooks/use-list-params'
import {
  useSheetParams,
  useSheetParamSelection,
} from '@/lib/sheets/use-sheet-params'
import type { LeadAssigneeOption, LeadBoardColumnData } from '@/lib/leads/types'
import type { LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'

import { LEADS_TABS } from '../_lib/tabs'
import { LeadsBoard } from './leads-board'
import { LeadSheet } from './lead-sheet'
import { ConvertLeadDialog } from './convert-lead-dialog'

type LeadsWorkspaceProps = {
  initialColumns: LeadBoardColumnData[]
  assignees: LeadAssigneeOption[]
  canManage: boolean
  senderName?: string
  /** True when the `?lead=` share link points at a lead that no longer exists. */
  leadNotFound?: boolean
  /** `?assignee=me`: the board shows only the viewer's leads. */
  onlyMine?: boolean
  viewerId: string
  /** `leads.convert`: dropping into Closed Won offers conversion. */
  canConvert?: boolean
}

const ASSIGNEE_OPTIONS = [{ value: 'me', label: 'My leads' }] as const

export function LeadsWorkspace({
  initialColumns,
  assignees,
  canManage,
  senderName,
  leadNotFound = false,
  onlyMine = false,
  viewerId,
  canConvert = false,
}: LeadsWorkspaceProps) {
  const router = useRouter()
  const { getAux } = useSheetParams()
  // The `?lead=` param drives the sheet: uuid = edit, `new` = create. Local
  // selection state opens the sheet instantly while the URL catches up.
  const { selectedId, isCreating, select, openCreate, clear } =
    useSheetParamSelection('lead')
  const [initialStatus, setInitialStatus] = useState<LeadStatusValue | null>(
    null
  )
  const [convertingLead, setConvertingLead] = useState<LeadRecord | null>(null)
  const [, startRefresh] = useTransition()
  const { update: updateListParams } = useListParams({
    basePath: '/leads',
    resetKeys: [],
  })
  // The sheet opens any lead on the board, filtered out or not.
  const leadLookup = useMemo(
    () => buildLeadLookup(initialColumns),
    [initialColumns]
  )
  const { visibleColumns, hiddenLeads } = useMemo(
    () => splitByAssignee(initialColumns, onlyMine ? viewerId : null),
    [initialColumns, onlyMine, viewerId]
  )
  const totalLeads = useMemo(
    () => visibleColumns.reduce((sum, column) => sum + column.leads.length, 0),
    [visibleColumns]
  )
  const activeLead = selectedId ? (leadLookup.get(selectedId) ?? null) : null
  const initialAction = getAux('leadMode') === 'convert' ? 'convert' : null

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

  // Only someone who may convert gets the dialog; anyone else just moves
  // the stage.
  const handleLeadClosedWon = useCallback(
    (lead: LeadRecord) => {
      if (canConvert) setConvertingLead(lead)
    },
    [canConvert]
  )

  const isSheetOpen = canManage && (isCreating || Boolean(activeLead))
  // Keep the last-opened lead rendered while the close animation plays so
  // the sheet doesn't flip to create mode (narrower layout) mid-exit.
  const [lastOpenedLead, setLastOpenedLead] = useState<LeadRecord | null>(null)
  if (activeLead && activeLead !== lastOpenedLead) {
    setLastOpenedLead(activeLead)
  }
  const sheetLead = isCreating ? null : (activeLead ?? lastOpenedLead)
  const boardActiveLeadId = isSheetOpen && sheetLead ? sheetLead.id : null

  const assigneeFilter = (
    <FilterSelect
      value={onlyMine ? 'me' : undefined}
      onChange={value => updateListParams({ assignee: value })}
      placeholder='All leads'
      options={ASSIGNEE_OPTIONS}
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
            activeCount={onlyMine ? 1 : 0}
          >
            {assigneeFilter}
          </FilterSheetButton>
          <div className='max-md:hidden md:contents'>{assigneeFilter}</div>
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
          initialAction={initialAction}
          onSuccess={handleSheetSuccess}
        />
      ) : null}
      {convertingLead && (
        <ConvertLeadDialog
          lead={convertingLead}
          open={!!convertingLead}
          onOpenChange={open => {
            if (!open) setConvertingLead(null)
          }}
          onSuccess={() => {
            setConvertingLead(null)
            startRefresh(() => {
              router.refresh()
            })
          }}
        />
      )}
      <LeadsBoard
        initialColumns={visibleColumns}
        hiddenLeads={hiddenLeads}
        canManage={canManage}
        onEditLead={handleEditLead}
        onCreateLead={handleCreateLead}
        onLeadClosedWon={handleLeadClosedWon}
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
