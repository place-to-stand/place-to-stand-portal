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
}

export function LeadsWorkspace({
  initialColumns,
  assignees,
  canManage,
  senderName,
  leadNotFound = false,
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
      <LeadsBoard
        initialColumns={initialColumns}
        canManage={canManage}
        onEditLead={handleEditLead}
        onCreateLead={handleCreateLead}
        onLeadClosedWon={handleLeadClosedWon}
        activeLeadId={boardActiveLeadId}
      />
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
