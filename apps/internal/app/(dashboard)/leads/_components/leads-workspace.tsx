'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import {
  useSheetParams,
  useSheetParamSelection,
} from '@/lib/sheets/use-sheet-params'
import type {
  LeadAssigneeOption,
  LeadBoardColumnData,
  LeadStalenessConfig,
} from '@/lib/leads/types'
import type { LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { daysSinceTouch, isLeadStale } from '@/lib/leads/updates'
import { formatCalendarDate } from '@/lib/dates'

import { LEADS_TABS } from '../_lib/tabs'
import { LeadsBoard } from './leads-board'
import { LeadSheet } from './lead-sheet'
import { ConvertLeadDialog } from './convert-lead-dialog'
import {
  LeadStalenessProvider,
  type LeadStaleSignal,
} from './lead-card'
import {
  LeadsBoardFiltersBar,
  useLeadsBoardFilters,
} from './leads-board-filters'

type LeadsWorkspaceProps = {
  initialColumns: LeadBoardColumnData[]
  assignees: LeadAssigneeOption[]
  canManage: boolean
  senderName?: string
  /** True when the `?lead=` share link points at a lead that no longer exists. */
  leadNotFound?: boolean
  /** Configured thresholds plus a server-stamped `now` (D19, D22). */
  staleness: LeadStalenessConfig
}

export function LeadsWorkspace({
  initialColumns,
  assignees,
  canManage,
  senderName,
  leadNotFound = false,
  staleness,
}: LeadsWorkspaceProps) {
  const router = useRouter()
  const { getAux } = useSheetParams()
  const filters = useLeadsBoardFilters(assignees)

  // Staleness is derived, never stored — a pure function of status, last touch,
  // creation date, and the configured threshold (same reasoning as D4). One
  // pass over the board resolves every card's signal.
  const staleSignals = useMemo(() => {
    const now = new Date(staleness.now)
    const signals = new Map<string, LeadStaleSignal>()

    for (const column of initialColumns) {
      for (const lead of column.leads) {
        if (
          !isLeadStale(
            lead.status,
            lead.lastTouchAt,
            lead.createdAt,
            staleness.thresholds,
            now
          )
        ) {
          continue
        }

        signals.set(lead.id, {
          days: daysSinceTouch(lead.lastTouchAt, lead.createdAt, now),
          lastTouchLabel: lead.lastTouchAt
            ? `last touched ${formatCalendarDate(lead.lastTouchAt)}`
            : `no touches logged since ${formatCalendarDate(lead.createdAt)}`,
        })
      }
    }

    return signals
  }, [initialColumns, staleness])

  // Client-side over the already-loaded board: every active lead is present, so
  // a server round trip would buy nothing and would fight the DnD state (D23).
  const visibleColumns = useMemo(() => {
    if (!filters.needsFollowUp && !filters.assigneeId) {
      return initialColumns
    }

    return initialColumns.map(column => ({
      ...column,
      leads: column.leads.filter(lead => {
        if (filters.needsFollowUp && !staleSignals.has(lead.id)) {
          return false
        }
        if (filters.assigneeId && lead.assigneeId !== filters.assigneeId) {
          return false
        }
        return true
      }),
    }))
  }, [filters.assigneeId, filters.needsFollowUp, initialColumns, staleSignals])
  // The `?lead=` param drives the sheet: uuid = edit, `new` = create. Local
  // selection state opens the sheet instantly while the URL catches up.
  const { selectedId, isCreating, select, openCreate, clear } =
    useSheetParamSelection('lead')
  const [initialStatus, setInitialStatus] = useState<LeadStatusValue | null>(
    null
  )
  const [convertingLead, setConvertingLead] = useState<LeadRecord | null>(null)
  const [, startRefresh] = useTransition()
  const leadLookup = useMemo(
    () => buildLeadLookup(initialColumns),
    [initialColumns]
  )
  const totalLeads = useMemo(
    () => initialColumns.reduce((sum, column) => sum + column.leads.length, 0),
    [initialColumns]
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

  const handleLeadClosedWon = useCallback((lead: LeadRecord) => {
    setConvertingLead(lead)
  }, [])

  const isSheetOpen = canManage && (isCreating || Boolean(activeLead))
  // Keep the last-opened lead rendered while the close animation plays so
  // the sheet doesn't flip to create mode (narrower layout) mid-exit.
  const [lastOpenedLead, setLastOpenedLead] = useState<LeadRecord | null>(null)
  if (activeLead && activeLead !== lastOpenedLead) {
    setLastOpenedLead(activeLead)
  }
  const sheetLead = isCreating ? null : (activeLead ?? lastOpenedLead)
  const boardActiveLeadId = isSheetOpen && sheetLead ? sheetLead.id : null

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/leads')}
      tabs={LEADS_TABS}
      activeTab='board'
      count={{ label: 'leads', total: totalLeads }}
      primaryAction={
        <DisabledFieldTooltip
          disabled={!canManage}
          reason='Admin access is required to create leads.'
        >
          <Button
            type='button'
            size='sm'
            disabled={!canManage}
            onClick={() => handleCreateLead()}
            className='gap-2'
          >
            <Plus className='h-4 w-4' />
            Add lead
          </Button>
        </DisabledFieldTooltip>
      }
      contentClassName='flex flex-col gap-4 sm:gap-6'
    >
      {leadNotFound && !isCreating ? (
        <div
          role='status'
          className='border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm'
        >
          <span>
            The linked lead could not be found. It may have been permanently
            deleted.
          </span>
          <Button variant='ghost' size='sm' onClick={clear}>
            Dismiss
          </Button>
        </div>
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
          thresholds={staleness.thresholds}
          onSuccess={handleSheetSuccess}
        />
      ) : null}
      {convertingLead && (
        <ConvertLeadDialog
          lead={convertingLead}
          open={!!convertingLead}
          onOpenChange={(open) => {
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
      <LeadsBoardFiltersBar
        filters={filters}
        assignees={assignees}
        staleCount={staleSignals.size}
      />
      <LeadStalenessProvider signals={staleSignals}>
        <LeadsBoard
          initialColumns={visibleColumns}
          canManage={canManage}
          onEditLead={handleEditLead}
          onCreateLead={handleCreateLead}
          onLeadClosedWon={handleLeadClosedWon}
          activeLeadId={boardActiveLeadId}
        />
      </LeadStalenessProvider>
    </PageShell>
  )
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
