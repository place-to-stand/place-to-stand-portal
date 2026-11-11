'use client'

import { Separator } from '@pts/ui/separator'
import { EntityList } from '@/components/sheets/entity-list'
import { SHEET_SIDE_COLUMN_CLASSES } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import { useCompanyBilling } from './company-billing-section'
import {
  CompanyBillingSection,
  CompanyClientReadOnly,
  CompanyProjectsSection,
} from './company-sheet-sections'

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
  /** Scroll targets, unique per sheet: two company sheets can be stacked. */
  billingSectionId: string
  projectsSectionId: string
}

/**
 * The company sheet's side column: Client. The Bill this company switch and
 * its billing, then its Projects. Below lg it stacks under the Company
 * column.
 */
export function CompanyClientColumn({
  canManage,
  clientCompanyId,
  wasClient,
  projectsCompanyId,
  isEditing,
  disabled,
  billingSectionId,
  projectsSectionId,
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
      <div className='flex flex-col gap-6 px-6 pt-6 pb-8'>
        <div
          id={billingSectionId}
          data-section='company-billing'
          className='flex scroll-mt-6 flex-col gap-6'
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
            <Separator />
            <div
              id={projectsSectionId}
              data-section='company-projects'
              className='scroll-mt-6'
            >
              <CompanyProjectsSection
                companyId={projectsCompanyId}
                canCreate={Boolean(clientCompanyId)}
              />
            </div>
          </>
        ) : canManage && billing.billingOn ? (
          // Becoming a client in this Save: projects start once it is one.
          <>
            <Separator />
            <div
              id={projectsSectionId}
              data-section='company-projects'
              className='scroll-mt-6'
            >
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
      </div>
    </div>
  )
}
