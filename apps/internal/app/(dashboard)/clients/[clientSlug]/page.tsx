import { wasClientCompany } from '@pts/db/client-state'
import { and, eq, or } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, } from '@/lib/db/schema'
import { UUID_PATTERN } from '@/lib/sheets/entities'

/**
 * A client is its company's billing record, so the client page is the
 * company sheet now: old links open it on its Projects tab.
 */
export default async function ClientDetailPage({
  params,
}: PageProps<'/clients/[clientSlug]'>) {
  await requireUser()
  const { clientSlug } = await params

  const [client] = await db
    .select({ companyId: companies.id })
    .from(companies)
    .where(and(wasClientCompany(), UUID_PATTERN.test(clientSlug)
        ? or(eq(companies.slug, clientSlug), eq(companies.id, clientSlug))
        : eq(companies.slug, clientSlug)))
    .limit(1)

  if (!client) notFound()
  redirect(`/companies?company=${client.companyId}&tab=projects`)
}
