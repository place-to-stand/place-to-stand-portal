'use client'

import type { ReactElement } from 'react'

import { RecordContextMenu } from '@/components/table/record-context-menu'
import { useRecordArchive } from '@/components/table/use-record-archive'
import type { LeadRecord } from '@/lib/leads/types'

import { archiveLead } from '../_actions/archive-lead'

/**
 * Right-click on a lead card: Edit, Duplicate, Archive. Archive confirms with
 * the same dialog as the lead sheet's.
 */
export function LeadContextMenu({
  lead,
  onEdit,
  canManage,
  children,
}: {
  lead: LeadRecord
  onEdit: () => void
  /** Managers drag cards (so no long-press menu); others get no menu. */
  canManage: boolean
  children: ReactElement<Record<string, unknown>>
}) {
  const { requestArchive, isPending, dialog } = useRecordArchive({
    entity: 'lead',
    noun: 'lead',
    list: 'the board',
    archive: async id => {
      const result = await archiveLead({ leadId: id })
      return result.success ? null : (result.error ?? 'Something went wrong.')
    },
  })
  return (
    <>
      <RecordContextMenu
        entity='lead'
        id={lead.id}
        onEdit={onEdit}
        onArchive={() =>
          requestArchive({ id: lead.id, name: lead.contactName })
        }
        pending={isPending}
        draggable={canManage}
        disabled={!canManage}
      >
        {children}
      </RecordContextMenu>
      {dialog}
    </>
  )
}
