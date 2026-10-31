'use client'

import { EmptyState } from '@pts/ui/empty-state'
import { Separator } from '@pts/ui/separator'
import { SheetSection } from '@/components/sheets/sheet-section'
import { SHEET_SIDE_COLUMN_CLASSES } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import { useCompanyBilling } from './company-billing-section'
import {
  CompanyBillingSection,
  CompanyClientReadOnly,
  CompanyProjectsSection,
} from './company-sheet-sections'

/** Deep-link targets in the Client column (`?tab=billing`, `?tab=projects`). */
export const COMPANY_BILLING_SECTION_ID = 'company-billing'
export const COMPANY_PROJECTS_SECTION_ID = 'company-projects'

type CompanyClientColumnProps = {
  /** Admins: billing, Make a client and projects. Others see where it stands. */
  canManage: boolean
  /** Billed now (a stop may be scheduled). */
  clientCompanyId: string | null
  /** Billed before and not now. */
  wasClient: boolean
  /** The company whose projects show (a client, or a former one with projects). */
  projectsCompanyId: string | null
  isEditing: boolean
  disabled: boolean
}

/**
 * The company sheet's side column: Client. Its billing (or the "Not a
 * client" panel and Make a client), then its Projects. Below lg it stacks
 * under the Company column.
 */
export function CompanyClientColumn({
  canManage,
  clientCompanyId,
  wasClient,
  projectsCompanyId,
  isEditing,
  disabled,
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
          id={COMPANY_BILLING_SECTION_ID}
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
            <Separator />
            <div id={COMPANY_PROJECTS_SECTION_ID} className='scroll-mt-6'>
              <SheetSection title='Projects'>
                <EmptyState
                  message={
                    isEditing
                      ? 'Add projects after you save the company as a client.'
                      : 'Add projects after you save the company.'
                  }
                />
              </SheetSection>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
