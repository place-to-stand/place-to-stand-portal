'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  ClientLinkPicker,
  type ClientLink,
} from '@/components/clients/client-link-picker'
import { SheetSection } from '@/components/sheets/sheet-section'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import {
  ClientRecordRow,
  LeadRecordRow,
} from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { roleCan } from '@/lib/auth/capabilities'
import type { CompanyLeadSummary } from '@/lib/companies/types'

import { SectionAddButton } from '@/components/sheets/section-add-button'

export function CompanyLeadsSection({
  leads,
}: {
  leads: CompanyLeadSummary[]
}) {
  return (
    <SheetSection
      title='Leads'
      action={
        <span className='text-muted-foreground text-xs'>{leads.length}</span>
      }
    >
      {leads.length === 0 ? (
        <EmptyState message='No leads at this company.' />
      ) : (
        <SheetRecordList>
          {leads.map(lead => (
            <LeadRecordRow key={lead.id} lead={lead} />
          ))}
        </SheetRecordList>
      )}
    </SheetSection>
  )
}

/**
 * A company has at most one client: this slot holds it, or links one.
 * Linking and unlinking are staged until Save. Unlinking keeps the client's
 * portal access list; the client sheet flags anyone not at its company.
 */
export function CompanyLinkedClientSection({
  companyId,
  client,
  staged,
  unlinking,
  disabled,
  onLink,
  onClearStaged,
  onUnlink,
  onUndoUnlink,
}: {
  companyId: string
  /** The client linked now, if any. */
  client: { id: string; name: string } | null
  /** A client picked here, linked on Save. */
  staged: ClientLink | null
  /** The linked client is set to unlink on Save. */
  unlinking: boolean
  disabled: boolean
  onLink: (client: ClientLink) => void
  onClearStaged: () => void
  onUnlink: () => void
  onUndoUnlink: () => void
}) {
  // Client records are admin-only; others just see the name.
  const { isAdmin, role } = useViewerAccess()
  const canManageClients = Boolean(role && roleCan(role, 'clients.manage'))
  const [pickerOpen, setPickerOpen] = useState(false)
  const shown = staged ?? (client && !unlinking ? client : null)
  const locked = disabled || !canManageClients
  const lockedReason = canManageClients
    ? null
    : 'Only an admin can link clients.'

  return (
    <SheetSection
      title='Linked client'
      action={
        shown ? null : locked ? (
          <SectionAddButton
            label='Link client'
            disabled={disabled}
            disabledReason={lockedReason}
          />
        ) : (
          // An unlinked client, or a new one created with this company.
          <ClientLinkPicker
            value={null}
            onChange={picked => (picked ? onLink(picked) : undefined)}
            createParams={{ clientCompanyId: companyId }}
            trigger={<SectionAddButton label='Link client' />}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />
        )
      }
    >
      {staged ? (
        <ClientRecordRow
          client={staged}
          linked
          note={<span className='text-warning'>Links on save</span>}
          actions={
            <RowActionButton
              type='button'
              disabled={disabled}
              label={`Don't link ${staged.name}`}
              onClick={onClearStaged}
              className='text-muted-foreground hover:text-destructive'
              icon={<X />}
            />
          }
        />
      ) : client && unlinking ? (
        <ClientRecordRow
          client={client}
          className='opacity-60'
          note={
            <span className='text-destructive'>
              Unlinks on save · portal access is kept
            </span>
          }
          actions={
            <Button
              type='button'
              variant='ghost'
              size='xs'
              className='text-muted-foreground'
              disabled={disabled}
              onClick={onUndoUnlink}
              aria-label={`Undo unlinking ${client.name}`}
            >
              Undo
            </Button>
          }
        />
      ) : client ? (
        <ClientRecordRow
          client={client}
          linked
          openable={isAdmin}
          actions={
            locked ? null : (
              <RowActionButton
                type='button'
                label='Unlink client'
                onClick={onUnlink}
                className='text-muted-foreground hover:text-destructive'
                icon={<X />}
              />
            )
          }
        />
      ) : (
        <EmptyState
          message={
            locked
              ? 'No client linked.'
              : 'No client linked. Link an existing client or create one.'
          }
          label={locked ? undefined : 'Link client'}
          onClick={locked ? undefined : () => setPickerOpen(true)}
        />
      )}
    </SheetSection>
  )
}
