import { NextResponse } from 'next/server'
import { and, eq, isNull, inArray } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { threads, messages, contacts, contactClients, clients, users } from '@/lib/db/schema'

type RouteParams = {
  params: Promise<{ threadId: string }>
}

type ContactCheckResult = {
  email: string
  name: string | null
  contact: {
    id: string
    name: string
    email: string
    phone: string | null
    linkedClients: Array<{
      id: string
      name: string
      isPrimary: boolean
    }>
  } | null
}

/**
 * GET /api/threads/[threadId]/contacts-check
 * Check if participant emails from a thread exist in the contacts table
 * Returns contact info and their linked clients
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const user = await requireUser()
  assertAdmin(user)

  const { threadId } = await params

  // Get the thread with participant emails
  const [thread] = await db
    .select({
      id: threads.id,
      participantEmails: threads.participantEmails,
    })
    .from(threads)
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1)

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  const participantEmails = thread.participantEmails ?? []
  if (participantEmails.length === 0) {
    return NextResponse.json({ ok: true, results: [] })
  }

  // Normalize emails for comparison
  const normalizedEmails = participantEmails.map(e => e.toLowerCase().trim())

  // Get admin user emails to filter out (they're internal team, not contacts)
  const adminUsers = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.role, 'ADMIN'),
        isNull(users.deletedAt)
      )
    )

  const adminEmails = new Set(
    adminUsers.map(u => u.email.toLowerCase().trim())
  )

  // Filter out admin emails from the list
  const externalEmails = normalizedEmails.filter(e => !adminEmails.has(e))

  if (externalEmails.length === 0) {
    return NextResponse.json({ ok: true, results: [] })
  }

  // Get names from thread messages for each participant email
  const threadMessages = await db
    .select({
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
    })
    .from(messages)
    .where(
      and(
        eq(messages.threadId, threadId),
        isNull(messages.deletedAt)
      )
    )

  // Build a map of email -> name (use the first non-null name found)
  const emailToName = new Map<string, string>()
  for (const msg of threadMessages) {
    const normalizedEmail = msg.fromEmail.toLowerCase().trim()
    if (msg.fromName && !emailToName.has(normalizedEmail)) {
      emailToName.set(normalizedEmail, msg.fromName)
    }
  }

  // Find contacts matching participant emails
  const matchingContacts = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
    })
    .from(contacts)
    .where(
      and(
        inArray(contacts.email, externalEmails),
        isNull(contacts.deletedAt)
      )
    )

  // Get client links for found contacts
  const contactIds = matchingContacts.map(c => c.id)
  const clientLinks = contactIds.length > 0
    ? await db
        .select({
          contactId: contactClients.contactId,
          clientId: contactClients.clientId,
          isPrimary: contactClients.isPrimary,
          clientName: clients.name,
        })
        .from(contactClients)
        .innerJoin(clients, eq(clients.id, contactClients.clientId))
        .where(
          and(
            inArray(contactClients.contactId, contactIds),
            isNull(clients.deletedAt)
          )
        )
    : []

  // Build results for each external participant email
  const results: ContactCheckResult[] = externalEmails.map(email => {
    const contact = matchingContacts.find(c => c.email.toLowerCase() === email)
    const name = emailToName.get(email) ?? null

    if (!contact) {
      return { email, name, contact: null }
    }

    const linkedClients = clientLinks
      .filter(link => link.contactId === contact.id)
      .map(link => ({
        id: link.clientId,
        name: link.clientName,
        isPrimary: link.isPrimary,
      }))

    return {
      email,
      name,
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        linkedClients,
      },
    }
  })

  return NextResponse.json({ ok: true, results })
}
