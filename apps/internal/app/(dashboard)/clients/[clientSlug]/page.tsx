import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, eq, isNull, desc } from 'drizzle-orm'

import { AppShellHeader } from '@/components/layout/app-shell'
import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, contactClients, users } from '@/lib/db/schema'
import {
  fetchClientsWithMetrics,
  fetchProjectsForClient,
  resolveClientIdentifier,
} from '@/lib/data/clients'
import { getMessagesForClient } from '@/lib/queries/messages'
import { getTranscriptsForClient, getTranscriptCountForClient } from '@/lib/queries/transcripts'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'

import { ClientsLandingHeader } from '../_components/clients-landing-header'
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

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { clientSlug } = await params
  const user = await requireUser()

  let client
  try {
    client = await resolveClientIdentifier(user, clientSlug)
  } catch {
    notFound()
  }

  const canManageClients = isAdmin(user)

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
    allClients,
    projects,
    clientContacts,
    messages,
    originationContact,
    originationUser,
    closerUser,
    clientTranscripts,
    transcriptCount,
  ] = await Promise.all([
    fetchClientsWithMetrics(user),
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
    getMessagesForClient(client.resolvedId),
    originationContactPromise,
    originationUserPromise,
    closerUserPromise,
    getTranscriptsForClient(client.resolvedId),
    getTranscriptCountForClient(client.resolvedId),
  ])

  return (
    <>
      <AppShellHeader>
        <ClientsLandingHeader
          clients={allClients}
          selectedClientId={client.resolvedId}
        />
      </AppShellHeader>
      <div className='space-y-6'>
        <ClientDetail
          client={client}
          projects={projects}
          contacts={clientContacts}
          messages={messages}
          transcripts={clientTranscripts}
          transcriptCount={transcriptCount}
          canManageClients={canManageClients}
          clientRow={mapClientDetailToRow(client)}
          currentUserId={user.id}
          originationContact={originationContact}
          originationUser={originationUser}
          closerUser={closerUser}
        />
      </div>
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
