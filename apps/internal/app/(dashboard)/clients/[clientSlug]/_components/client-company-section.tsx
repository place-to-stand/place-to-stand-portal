'use client'

import { Briefcase } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'
import { CompanyRecordRow } from '@/components/sheets/entity-record-rows'
import { SheetRecordList } from '@/components/sheets/sheet-record-row'
import { displayWebsiteHost } from '@/lib/companies/website'
import { useSheetParams } from '@/lib/sheets/use-sheet-params'

type Props = {
  clientId: string
  company: { id: string; name: string; website: string | null } | null
}

/**
 * The client's company (one-to-one), as its own card. The row opens the
 * company sheet; with none linked, "Link company" opens the client sheet,
 * where the link is made.
 */
export function ClientCompanySection({ clientId, company }: Props) {
  const { open } = useSheetParams()
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/10'>
          <Briefcase className='h-4 w-4 text-indigo-500' />
        </div>
        <h2 className='font-semibold'>Company</h2>
      </div>
      <div className='p-3'>
        {company ? (
          <SheetRecordList>
            <CompanyRecordRow
              company={company}
              linked
              note={
                company.website
                  ? displayWebsiteHost(company.website)
                  : undefined
              }
            />
          </SheetRecordList>
        ) : (
          <EmptyState
            message='No linked company yet.'
            label='Link company'
            onClick={() => open('client', clientId)}
          />
        )}
      </div>
    </section>
  )
}
