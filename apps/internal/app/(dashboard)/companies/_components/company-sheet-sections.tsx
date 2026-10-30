'use client'

import type { Ref, RefObject } from 'react'
import Link from 'next/link'

import { EmptyState } from '@pts/ui/empty-state'
import { Button } from '@pts/ui/button'
import { SheetSection } from '@/components/sheets/sheet-section'
import { LeadRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import type { CompanyLeadSummary } from '@/lib/companies/types'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

import {
  CompanyBillingSection,
  type CompanyBillingHandle,
} from './company-billing-section'

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
 * Billing, for admins: a company you bill is a client, and its billing
 * record is edited here. Without one, "Make client" sets it up.
 */
export function CompanyBillingSlot({
  companyId,
  client,
  open,
  disabled,
  billingRef,
  onDirtyChange,
  onSaved,
}: {
  companyId: string
  client: { id: string; name: string; slug?: string | null } | null
  open: boolean
  disabled: boolean
  billingRef: Ref<CompanyBillingHandle>
  onDirtyChange: (dirty: boolean) => void
  onSaved: () => void
}) {
  const { openNew } = useSheetParams()
  const handle = billingRef as RefObject<CompanyBillingHandle | null>

  return (
    <SheetSection
      title='Client'
      description={
        client
          ? 'This company is a client. Its billing, commission and portal access save with the company.'
          : undefined
      }
      action={
        client ? (
          <div className='flex items-center gap-1'>
            {client.slug ? (
              <Button asChild type='button' variant='ghost' size='xs'>
                <Link href={`/clients/${client.slug}`}>Client page</Link>
              </Button>
            ) : null}
            <Button
              type='button'
              variant='ghost'
              size='xs'
              className='text-muted-foreground hover:text-destructive'
              disabled={disabled}
              onClick={() => handle.current?.requestStopBilling()}
            >
              Stop billing
            </Button>
          </div>
        ) : (
          <SectionAddButton
            label='Make client'
            disabled={disabled}
            onClick={() => openNew('client', { clientCompanyId: companyId })}
          />
        )
      }
    >
      {client ? (
        <CompanyBillingSection
          clientId={client.id}
          open={open}
          onSaved={onSaved}
          handleRef={billingRef}
          onDirtyChange={onDirtyChange}
        />
      ) : (
        <EmptyState
          message='Not a client yet. Make client sets up billing, commission and portal access.'
          label={disabled ? undefined : 'Make client'}
          onClick={
            disabled
              ? undefined
              : () => openNew('client', { clientCompanyId: companyId })
          }
        />
      )}
    </SheetSection>
  )
}
