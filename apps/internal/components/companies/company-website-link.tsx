'use client'

import { ExternalLink } from 'lucide-react'

import { useCompanyOptions } from '@/components/companies/company-link-picker'
import { displayWebsiteHost, toWebsiteHref } from '@/lib/companies/website'

/** A website as the small external link shown under a company field. */
export function WebsiteLink({ website }: { website: string | null }) {
  if (!website) return null
  return (
    <a
      href={toWebsiteHref(website)}
      target='_blank'
      rel='noopener noreferrer'
      className='text-primary inline-flex w-fit items-center gap-1 text-xs hover:underline'
    >
      {displayWebsiteHost(website)}
      <ExternalLink className='size-3' />
    </a>
  )
}

/** The picked company's website, read-only: the company owns it. */
export function CompanyWebsiteLink({ companyId }: { companyId: string | null }) {
  const { data = [] } = useCompanyOptions()
  const website = companyId
    ? (data.find(company => company.id === companyId)?.website ?? null)
    : null
  return <WebsiteLink website={website} />
}
