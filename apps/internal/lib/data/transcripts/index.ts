import 'server-only'

import { isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, projects, leads } from '@/lib/db/schema'

/**
 * Fetch active clients for AI classification prompt.
 */
export async function fetchActiveClientsForClassification() {
  return db
    .select({
      id: clients.id,
      name: clients.name,
    })
    .from(clients)
    .where(isNull(clients.deletedAt))
}

/**
 * Fetch active projects with client name for AI classification prompt.
 */
export async function fetchActiveProjectsForClassification() {
  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))

  const allClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(isNull(clients.deletedAt))

  const clientNameMap = new Map(allClients.map(c => [c.id, c.name]))

  return allProjects
    .filter(p => p.clientId)
    .map(p => ({
      id: p.id,
      name: p.name,
      clientId: p.clientId!,
      clientName: clientNameMap.get(p.clientId!) ?? 'Unknown',
    }))
}

/**
 * Fetch active leads for AI classification prompt.
 */
export async function fetchActiveLeadsForClassification() {
  return db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      companyName: leads.companyName,
    })
    .from(leads)
    .where(isNull(leads.deletedAt))
}
