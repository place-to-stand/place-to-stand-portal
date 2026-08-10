'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import type { LeadAssigneeOption, LeadBoardColumnData } from '@/lib/leads/types'
import type { LeadRecord } from '@/lib/leads/types'
import type { LeadStatusValue } from '@/lib/leads/constants'

import { LEADS_TABS } from '../_lib/tabs'
import { LeadsBoard } from './leads-board'
import { LeadSheet } from './lead-sheet'
import { ConvertLeadDialog } from './convert-lead-dialog'

const LEAD_SHEET_CLOSE_MS = 320

type LeadsWorkspaceProps = {
  initialColumns: LeadBoardColumnData[]
  assignees: LeadAssigneeOption[]
  canManage: boolean
  activeLeadId: string | null
  activeAction?: string | null
  senderName?: string
  /** True on the /leads/new deep link — opens the create sheet on mount. */
  startCreating?: boolean
}

export function LeadsWorkspace({
  initialColumns,
  assignees,
  canManage,
  activeLeadId,
  activeAction = null,
  senderName,
  startCreating = false,
}: LeadsWorkspaceProps) {
  const router = useRouter()
  const [isCreatingLead, setIsCreatingLead] = useState(startCreating)
  const [initialStatus, setInitialStatus] = useState<LeadStatusValue | null>(
    null
  )
  const [closingLeadId, setClosingLeadId] = useState<string | null>(null)
  const [convertingLead, setConvertingLead] = useState<LeadRecord | null>(null)
  const [isSheetClosing, setIsSheetClosing] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, startRefresh] = useTransition()
  const leadLookup = useMemo(
    () => buildLeadLookup(initialColumns),
    [initialColumns]
  )
  const totalLeads = useMemo(
    () => initialColumns.reduce((sum, column) => sum + column.leads.length, 0),
    [initialColumns]
  )
  const activeLead = activeLeadId
    ? (leadLookup.get(activeLeadId) ?? null)
    : null

  const cancelPendingClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsSheetClosing(false)
  }, [])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [])

  const handleCreateLead = useCallback(
    (status?: LeadStatusValue) => {
      if (!canManage) {
        return
      }

      cancelPendingClose()
      setClosingLeadId(null)
      setInitialStatus(status ?? null)
      setIsCreatingLead(true)
      router.push('/leads', { scroll: false })
    },
    [canManage, cancelPendingClose, router]
  )

  const handleEditLead = useCallback(
    (lead: LeadRecord) => {
      if (!canManage) {
        return
      }

      cancelPendingClose()
      setClosingLeadId(null)
      setIsCreatingLead(false)
      router.push(`/leads/${lead.id}`, { scroll: false })
    },
    [canManage, cancelPendingClose, router]
  )

  const beginSheetClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
    }

    setIsSheetClosing(true)
    closeTimeoutRef.current = setTimeout(() => {
      setIsSheetClosing(false)
      closeTimeoutRef.current = null
    }, LEAD_SHEET_CLOSE_MS)
  }, [])

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        cancelPendingClose()
        setClosingLeadId(null)
        return
      }

      beginSheetClose()

      if (isCreatingLead) {
        setIsCreatingLead(false)
        setInitialStatus(null)
        // Leave /leads/new so a refresh doesn't reopen the create sheet.
        router.push('/leads', { scroll: false })
        startRefresh(() => {
          router.refresh()
        })
        return
      }

      if (activeLeadId) {
        setClosingLeadId(activeLeadId)
        router.push('/leads', { scroll: false })
      }
      startRefresh(() => {
        router.refresh()
      })
    },
    [
      activeLeadId,
      beginSheetClose,
      cancelPendingClose,
      isCreatingLead,
      router,
      startRefresh,
    ]
  )

  const handleSheetSuccess = useCallback(() => {
    startRefresh(() => {
      router.refresh()
    })
  }, [router, startRefresh])

  const handleLeadClosedWon = useCallback(
    (lead: LeadRecord) => {
      setConvertingLead(lead)
    },
    []
  )

  const isRouteLeadOpen =
    Boolean(activeLeadId) && activeLeadId !== closingLeadId
  const isSheetOpen = isCreatingLead || isRouteLeadOpen
  const sheetLead = isCreatingLead ? null : activeLead
  const shouldRenderSheet = canManage && (isSheetOpen || isSheetClosing)
  const boardActiveLeadId =
    isCreatingLead || closingLeadId === activeLeadId ? null : activeLeadId

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
      {shouldRenderSheet ? (
        <LeadSheet
          open={isSheetOpen}
          onOpenChange={handleSheetOpenChange}
          lead={sheetLead}
          initialStatus={initialStatus}
          assignees={assignees}
          canManage={canManage}
          senderName={senderName}
          initialAction={activeAction}
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
