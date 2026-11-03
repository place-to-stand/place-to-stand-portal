import { notFound, redirect } from 'next/navigation'

import { requirePage } from '@/lib/auth/session'
import { findClientCompanyForLegacyLink } from '@/lib/queries/legacy-client-ids'
import { companySheetHref } from '@/lib/sheets/hrefs'

/**
 * Old bookmarks only: there is no client page. A client is a company you
 * bill, so `/clients/<slug or id>` opens that company at its Projects
 * (ids from before 0111 resolve through the archive map).
 */
export default async function ClientDetailPage({
  params,
}: PageProps<'/clients/[clientSlug]'>) {
  await requirePage('clients.manage')
  const { clientSlug } = await params
  const company = await findClientCompanyForLegacyLink(clientSlug)

  if (!company) notFound()
  redirect(companySheetHref(company.id))
}
