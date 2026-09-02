import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { and, eq, isNull, desc } from 'drizzle-orm'

import { PageShell } from '@/components/layout/page-shell'
import { crumbsForNav } from '@/lib/navigation/breadcrumbs'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, contactClients, users } from '@/lib/db/schema'
import {
  fetchClientCycleDirectory,
  fetchProjectsForClient,
  resolveClientIdentifier,
} from '@/lib/data/clients'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'

import { ClientRecordCycle } from '../_components/client-record-cycle'
import { ClientDetail } from './_components/client-detail'

type Params = Promise<{ clientSlug: string }>

type ClientDetailPageProps = {
  params: Params
}

export async function generateMetadata({
  params,
}: ClientDetailPageProps): Promise<Metadata> {
  const { clientSlug } = await params

  try {
    const user = await requireUser()
    const client = await resolveClientIdentifier(user, clientSlug)

    return {
      title: `${client.name} | Clients | Place to Stand Portal`,
    }
  } catch {
    return {
      title: 'Client Not Found | Place to Stand Portal',
    }
  }
}

// All auth + data access lives here, behind Suspense, so the page keeps a
// prerenderable shell and client navigations commit instantly (Cache
// Components instant-navigation pattern).
async function ClientDetailContent({ params }: ClientDetailPageProps) {
  const { clientSlug } = await params
  const user = await requireUser()

  let client
  try {
    client = await resolveClientIdentifier(user, clientSlug)
  } catch {
    notFound()
  }

  // Build origination and closer lookups. Origination may be either a
  // contact (external referrer) or an admin user (internal partner);
  // closer is always an admin user.
  const originationContactPromise = client.originationContactId
    ? db
        .select({
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.id, client.originationContactId),
            isNull(contacts.deletedAt)
          )
        )
        .limit(1)
        .then(rows => rows[0] ?? null)
    : Promise.resolve(null)

  const originationUserPromise = client.originationUserId
    ? db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
          and(
            eq(users.id, client.originationUserId),
            isNull(users.deletedAt)
          )
        )
        .limit(1)
        .then(rows => rows[0] ?? null)
    : Promise.resolve(null)

  const closerUserPromise = client.closerUserId
    ? db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
          and(
            eq(users.id, client.closerUserId),
            isNull(users.deletedAt)
          )
        )
        .limit(1)
        .then(rows => rows[0] ?? null)
    : Promise.resolve(null)

  const [
    cycleClients,
    projects,
    clientContacts,
    originationContact,
    originationUser,
    closerUser,
  ] = await Promise.all([
    fetchClientCycleDirectory(user),
    fetchProjectsForClient(user, client.resolvedId),
    // Fetch contacts for this client via junction table
    db.select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
      createdBy: contacts.createdBy,
      userId: contacts.userId,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
      deletedAt: contacts.deletedAt,
      isPrimary: contactClients.isPrimary,
    })
      .from(contactClients)
      .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
      .where(
        and(
          eq(contactClients.clientId, client.resolvedId),
          isNull(contacts.deletedAt)
        )
      )
      .orderBy(desc(contactClients.isPrimary), contacts.email),
    originationContactPromise,
    originationUserPromise,
    closerUserPromise,
  ])

  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: client.name }]}
      contentClassName='space-y-6'
    >
      <ClientRecordCycle
        clients={cycleClients}
        selectedClientId={client.resolvedId}
      />
      <ClientDetail
        client={client}
        projects={projects}
        contacts={clientContacts}
        clientRow={mapClientDetailToRow(client)}
        currentUserId={user.id}
        originationContact={originationContact}
        originationUser={originationUser}
        closerUser={closerUser}
      />
    </PageShell>
  )
}

// Static crumb portion only — the client name comes from fetched data, so the
// fallback shows a generic placeholder while the content streams in.
function ClientDetailPageFallback() {
  return (
    <PageShell
      breadcrumbs={[...crumbsForNav('/clients'), { label: 'Client' }]}
      contentClassName='space-y-6'
    >
      <section className='bg-background h-96 animate-pulse rounded-xl border p-4 shadow-sm' />
    </PageShell>
  )
}

// generateMetadata reads runtime data (`params` + DB), which Cache Components
// only allows when the page itself is dynamic. This marker opts the page into
// dynamic rendering without blocking the prerendered shell.
async function Connection() {
  await connection()
  return null
}

function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  )
}

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
  return (
    <>
      <Suspense fallback={<ClientDetailPageFallback />}>
        <ClientDetailContent params={params} />
      </Suspense>
      <DynamicMarker />
    </>
  )
}

function mapClientDetailToRow(
  client: Awaited<ReturnType<typeof resolveClientIdentifier>>
): ClientRow {
  return {
    id: client.resolvedId,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    website: client.website,
    state: client.state ?? null,
    origination_contact_id: client.originationContactId,
    origination_user_id: client.originationUserId,
    closer_user_id: client.closerUserId,
    billing_type: client.billingType,
    created_by: null,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
  }
}
