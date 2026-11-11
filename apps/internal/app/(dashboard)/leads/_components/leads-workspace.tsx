'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { SheetCreateButton } from '@/components/sheets/sheet-create-button'
import { DeepLinkNotFoundNotice } from '@/components/table/deep-link-not-found'
import { PagePanel } from '@/components/layout/page-panel'
import { BOARD_PANEL_CLASS } from '@/components/board/board-column'
import {
  useDeepLinkNotFound,
  useSheetParamSelection,
  useSheetParams,
} from '@/lib/sheets/use-sheet-params'
import { setSheetSectionTarget } from '@/lib/sheets/sheet-section-target'
import type { LeadAssigneeOption, LeadBoardColumnData } from '@/lib/leads/types'
import type { LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'
import { LEAD_WON_NEEDS_COMPANY_MESSAGE } from '@/lib/leads/won-rule'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import { roleCan } from '@/lib/auth/capabilities'

import { LEADS_TABS } from '../_lib/tabs'
import { isLeadSourceType, splitLeadBoard } from '../_lib/board-filters'
import { LeadsBoardFilters } from './leads-board-filters'
import { LeadsBoard } from './leads-board'
import { LeadSheet } from './lead-sheet'
import { PageSheetEntry } from '@/lib/sheets/page-sheet-entry'

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
  const showLeadNotFound = useDeepLinkNotFound('lead', leadNotFound)
  const [initialStatus, setInitialStatus] = useState<LeadStatusValue | null>(
    null
  )
  // Set when a Won drag was refused for want of a company: the lead's sheet
  // opens with the reason on its Company field.
  const [companyErrorLeadId, setCompanyErrorLeadId] = useState<string | null>(
    null
  )
  const [, startRefresh] = useTransition()
  // The sheet opens any lead on the board, filtered out or not.
  const leadLookup = useMemo(
    () => buildLeadLookup(initialColumns),
    [initialColumns]
  )
  // Search and source filter the board in the browser: it already holds
  // every lead, so typing never reloads the page.
  const searchParams = useSearchParams()
  const search = searchParams.get('q')?.trim() || undefined
  const rawSource = searchParams.get('source')
  const source = isLeadSourceType(rawSource) ? rawSource : undefined
  const { visibleColumns, hiddenLeads, ownedCount } = useMemo(
    () =>
      splitLeadBoard(initialColumns, {
        assigneeId: assigneeFilter === 'all' ? null : assigneeFilter,
        search,
        source,
      }),
    [initialColumns, assigneeFilter, search, source]
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
      setCompanyErrorLeadId(null)
      select(lead.id)
    },
    [canManage, select]
  )

  const handleWonNeedsCompany = useCallback(
    (lead: LeadRecord) => {
      setInitialStatus(null)
      setCompanyErrorLeadId(lead.id)
      select(lead.id)
    },
    [select]
  )

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        return
      }

      setInitialStatus(null)
      setCompanyErrorLeadId(null)
      clear()
      startRefresh(() => {
        router.refresh()
      })
    },
    [clear, router, startRefresh]
  )

  // Winning a lead opens its company's billing (its sheet's Client column) next, for whoever can
  // make it a client there (the same step the lead sheet takes on save).
  const { role } = useViewerAccess()
  const canManageClients = roleCan(role, 'clients.manage')
  const { open: openSheet } = useSheetParams()
  const handleLeadClosedWon = useCallback(
    (lead: LeadRecord) => {
      if (!lead.companyId) return
      // Open it here, over the board, rather than leaving for /companies.
      setSheetSectionTarget('company', lead.companyId, 'billing')
      openSheet('company', lead.companyId)
    },
    [openSheet]
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

  return (
    <PageShell
      breadcrumbs={crumbsForNav('/leads')}
      tabs={LEADS_TABS}
      activeTab='board'
      count={{
        label: 'leads',
        total: ownedCount,
        filteredTotal: totalLeads,
      }}
      primaryAction={
        <SheetCreateButton
          entity='lead'
          label='Create lead'
          disabledReason={
            canManage ? null : 'Admin access is required to create leads.'
          }
        />
      }
      // Kanban board: pin to the viewport (columns scroll internally).
      contentClassName='flex h-full min-h-0 flex-col gap-4 sm:gap-6'
    >
      {showLeadNotFound && !isCreating ? (
        <DeepLinkNotFoundNotice entity='lead' onDismiss={clear} />
      ) : null}
      {canManage ? (
        <PageSheetEntry entity='lead'>
          <LeadSheet
            open={isSheetOpen}
            onOpenChange={handleSheetOpenChange}
            lead={sheetLead}
            initialStatus={initialStatus}
            initialCompanyError={
              sheetLead && sheetLead.id === companyErrorLeadId
                ? LEAD_WON_NEEDS_COMPANY_MESSAGE
                : null
            }
            assignees={assignees}
            canManage={canManage}
            senderName={senderName}
            onSuccess={handleSheetSuccess}
          />
        </PageSheetEntry>
      ) : null}
      {/* The same panel as a list: filter bar on top, the board below it. */}
      <PagePanel className={BOARD_PANEL_CLASS}>
        <LeadsBoardFilters
          search={search}
          source={source}
          assigneeFilter={assigneeFilter}
          viewerId={viewerId}
          people={pickerPeople}
        />
        <LeadsBoard
          initialColumns={visibleColumns}
          hiddenLeads={hiddenLeads}
          canManage={canManage}
          onEditLead={handleEditLead}
          onCreateLead={handleCreateLead}
          onLeadClosedWon={canManageClients ? handleLeadClosedWon : undefined}
          onWonNeedsCompany={handleWonNeedsCompany}
          activeLeadId={boardActiveLeadId}
          emptyMessage={
            ownedCount > 0 ? 'No leads match the current filters.' : undefined
          }
        />
      </PagePanel>
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
