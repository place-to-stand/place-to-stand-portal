import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import { clientCreatedEvent } from '@/lib/activity/events/clients'
import { contactInvitedToPortalEvent } from '@/lib/activity/events/contacts'
import { projectCreatedEvent } from '@/lib/activity/events/projects'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import {
  clients,
  clientMembers,
  contactClients,
  contacts,
  projects,
} from '@/lib/db/schema'
import { CLIENT_BILLING_TYPE_VALUES } from '@/lib/settings/clients/billing-types'
import {
  generateUniqueClientSlug,
  toClientSlug,
} from '@/lib/settings/clients/client-service'
import {
  generateUniqueProjectSlug,
  toProjectSlug,
} from '@/lib/settings/projects/project-service'
import { findOrCreatePortalUser } from '@/lib/settings/users/services/find-or-create-portal-user'

import {
  buildMutationResult,
  type ContactMutationContext,
  type ContactMutationResult,
} from './types'

export const promoteToClientInputSchema = z.object({
  contactId: z.string().uuid(),
  clientName: z.string().min(1, 'Client name is required'),
  projectName: z.string().min(1, 'Project name is required'),
  billingType: z.enum(CLIENT_BILLING_TYPE_VALUES),
})

export type PromoteToClientInput = z.infer<typeof promoteToClientInputSchema>

export async function promoteContactToClientMutation(
  context: ContactMutationContext,
  input: PromoteToClientInput
): Promise<ContactMutationResult> {
  const { user } = context

  try {
    assertAdmin(user)
  } catch (error) {
    if (error instanceof Error) {
      return buildMutationResult({ error: error.message })
    }
    return buildMutationResult({ error: 'Admin privileges required.' })
  }

  // 1. Load and validate contact
  const [contact] = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      userId: contacts.userId,
      deletedAt: contacts.deletedAt,
    })
    .from(contacts)
    .where(eq(contacts.id, input.contactId))
    .limit(1)

  if (!contact) {
    return buildMutationResult({ error: 'Contact not found.' })
  }

  if (contact.deletedAt) {
    return buildMutationResult({ error: 'Cannot promote an archived contact.' })
  }

  if (contact.userId) {
    return buildMutationResult({
      error: 'This contact already has portal access.',
    })
  }

  // Check no linked clients
  const linkedClients = await db
    .select({ clientId: contactClients.clientId })
    .from(contactClients)
    .innerJoin(clients, eq(contactClients.clientId, clients.id))
    .where(
      and(
        eq(contactClients.contactId, contact.id),
        isNull(clients.deletedAt)
      )
    )

  if (linkedClients.length > 0) {
    return buildMutationResult({
      error:
        'This contact already has linked clients. Use "Invite to Portal" instead.',
    })
  }

  // 2. Create client
  const clientSlug = await generateUniqueClientSlug(
    toClientSlug(input.clientName)
  )

  const [newClient] = await db
    .insert(clients)
    .values({
      name: input.clientName,
      slug: clientSlug,
      billingType: input.billingType,
      createdBy: user.id,
    })
    .returning({ id: clients.id })

  if (!newClient) {
    return buildMutationResult({ error: 'Failed to create client.' })
  }

  // 3. Link contact to client
  await db.insert(contactClients).values({
    contactId: contact.id,
    clientId: newClient.id,
    isPrimary: true,
  })

  // 4. Create ONBOARDING project
  const projectSlug = await generateUniqueProjectSlug(
    toProjectSlug(input.projectName)
  )

  const [newProject] = await db
    .insert(projects)
    .values({
      name: input.projectName,
      slug: projectSlug,
      type: 'CLIENT',
      clientId: newClient.id,
      status: 'ONBOARDING',
      createdBy: user.id,
    })
    .returning({ id: projects.id })

  if (!newProject) {
    return buildMutationResult({ error: 'Failed to create project.' })
  }

  // 5. Find or create portal user
  const portalResult = await findOrCreatePortalUser(user, {
    email: contact.email,
    fullName: contact.name,
  })

  if (portalResult.error || !portalResult.userId) {
    return buildMutationResult({
      error: portalResult.error ?? 'Failed to create portal user.',
    })
  }

  const userId = portalResult.userId

  // 6. Link contact to user
  await db
    .update(contacts)
    .set({
      userId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(contacts.id, contact.id))

  // 7. Insert client_members record
  const [existingMember] = await db
    .select({ id: clientMembers.id, deletedAt: clientMembers.deletedAt })
    .from(clientMembers)
    .where(
      and(
        eq(clientMembers.clientId, newClient.id),
        eq(clientMembers.userId, userId)
      )
    )
    .limit(1)

  if (existingMember) {
    if (existingMember.deletedAt) {
      await db
        .update(clientMembers)
        .set({ deletedAt: null })
        .where(eq(clientMembers.id, existingMember.id))
    }
  } else {
    await db.insert(clientMembers).values({
      clientId: newClient.id,
      userId,
    })
  }

  // 8. Log activity events
  const clientEvent = clientCreatedEvent({
    name: input.clientName,
    memberIds: [userId],
  })
  const projectEvent = projectCreatedEvent({
    name: input.projectName,
    status: 'ONBOARDING',
  })
  const contactEvent = contactInvitedToPortalEvent({
    email: contact.email,
    name: contact.name,
  })

  await Promise.all([
    logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: clientEvent.verb,
      summary: clientEvent.summary,
      targetType: 'CLIENT',
      targetId: newClient.id,
      metadata: clientEvent.metadata,
    }),
    logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: projectEvent.verb,
      summary: projectEvent.summary,
      targetType: 'PROJECT',
      targetId: newProject.id,
      targetClientId: newClient.id,
      targetProjectId: newProject.id,
      metadata: projectEvent.metadata,
    }),
    logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: contactEvent.verb,
      summary: contactEvent.summary,
      targetType: 'CONTACT',
      targetId: contact.id,
      metadata: contactEvent.metadata,
    }),
  ])

  return buildMutationResult({})
}
