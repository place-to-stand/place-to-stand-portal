import { wasClientCompany } from '@pts/db/client-state'
import { and, eq, or } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { companyIdForLegacyClientId } from '@/lib/queries/legacy-client-ids'
import { companySheetHref } from '@/lib/sheets/hrefs'
import { UUID_PATTERN } from '@/lib/sheets/entities'

/**
 * Old bookmarks only: there is no client page. A client is a company you
 * bill, so `/clients/<slug or id>` opens that company on its Projects tab
 * (ids from before 0111 resolve through the archive map).
 */
export default async function ClientDetailPage({
  params,
}: PageProps<'/clients/[clientSlug]'>) {
  await requireUser()
  const { clientSlug } = await params
  const id = UUID_PATTERN.test(clientSlug)
    ? await companyIdForLegacyClientId(clientSlug)
    : null

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        wasClientCompany(),
        id
          ? or(eq(companies.slug, clientSlug), eq(companies.id, id))
          : eq(companies.slug, clientSlug)
      )
    )
    .limit(1)

  if (!company) notFound()
  redirect(companySheetHref(company.id, 'projects'))
}
