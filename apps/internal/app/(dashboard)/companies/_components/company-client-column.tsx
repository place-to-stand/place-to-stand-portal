'use client'

import { SHEET_SECTIONS_CLASS } from '@/components/sheets/sheet-section'

import { EntityList } from '@/components/sheets/entity-list'
import { SHEET_SIDE_COLUMN_CLASSES } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import { useCompanyBilling } from './company-billing-section'
import {
  CompanyBillingSection,
  CompanyClientReadOnly,
  CompanyProjectsSection,
  CompanyClientUpdates,
} from './company-sheet-sections'

/** Deep-link targets in the Client column (`?tab=billing`, `?tab=projects`). */
export const COMPANY_BILLING_SECTION_ID = 'company-billing'
export const COMPANY_PROJECTS_SECTION_ID = 'company-projects'

type CompanyClientColumnProps = {
  /** Admins: the Bill this company switch, billing and projects. Others see where it stands. */
  canManage: boolean
  /** Billed now (a stop may be scheduled). */
  clientCompanyId: string | null
  /** Billed before and not now. */
  wasClient: boolean
  /** The company whose projects show (a client, or a former one with projects). */
  projectsCompanyId: string | null
  isEditing: boolean
  disabled: boolean
  /** Admins editing a client or former client: its updates, always last. */
  updatesCompanyId: string | null
}

/**
 * The company sheet's side column: Client. The Bill this company switch and
 * its billing, then its Projects, then its client updates (last). Below lg it stacks
 * under the Company column.
 */
export function CompanyClientColumn({
  canManage,
  clientCompanyId,
  wasClient,
  projectsCompanyId,
  isEditing,
  disabled,
  updatesCompanyId,
}: CompanyClientColumnProps) {
  const billing = useCompanyBilling()

  return (
    <div
      className={cn(
        'bg-muted/20 flex-shrink-0 max-lg:border-t lg:overflow-y-auto',
        // Billing terms and projects get an even share of the sheet.
        SHEET_SIDE_COLUMN_CLASSES.even
      )}
    >
      <div className={cn(SHEET_SECTIONS_CLASS, 'px-6 pt-6 pb-8')}>
        <div
          id={COMPANY_BILLING_SECTION_ID}
          className={cn(SHEET_SECTIONS_CLASS, 'scroll-mt-6')}
        >
          {canManage ? (
            <CompanyBillingSection
              companyId={clientCompanyId}
              disabled={disabled}
            />
          ) : (
            <CompanyClientReadOnly
              isClient={Boolean(clientCompanyId)}
              wasClient={wasClient}
            />
          )}
        </div>
        {canManage && isEditing && projectsCompanyId ? (
          <>
            <div id={COMPANY_PROJECTS_SECTION_ID} className='scroll-mt-6'>
              <CompanyProjectsSection
                companyId={projectsCompanyId}
                canCreate={Boolean(clientCompanyId)}
              />
            </div>
          </>
        ) : canManage && billing.billingOn ? (
          // Becoming a client in this Save: projects start once it is one.
          <>
            <div id={COMPANY_PROJECTS_SECTION_ID} className='scroll-mt-6'>
              <EntityList
                title='Projects'
                isEmpty
                emptyMessage={
                  isEditing
                    ? 'Add projects after you save the company as a client.'
                    : 'Add projects after you save the company.'
                }
              />
            </div>
          </>
        ) : null}
        {/* The activity stream sits last, under everything else. */}
        {updatesCompanyId ? (
          <CompanyClientUpdates companyId={updatesCompanyId} />
        ) : null}
      </div>
    </div>
  )
}
