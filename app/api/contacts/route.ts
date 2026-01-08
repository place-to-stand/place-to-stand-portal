import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import { contactCreatedEvent } from '@/lib/activity/events/contacts'

const createContactSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase().trim()),
  name: z.string().min(1, 'Name is required').max(100).transform(v => v.trim()),
  phone: z.string().optional().transform(v => v?.trim() || null),
})

/**
 * POST /api/contacts
 * Create a new contact or return existing one
 */
export async function POST(req: Request) {
  const user = await requireUser()
  assertAdmin(user)

  const body = await req.json()
  const parsed = createContactSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const { email, name, phone } = parsed.data

  try {
    // Check if contact already exists
    const [existingContact] = await db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(and(eq(contacts.email, email), isNull(contacts.deletedAt)))
      .limit(1)

    if (existingContact) {
      // Return existing contact
      return NextResponse.json({
        ok: true,
        id: existingContact.id,
        existed: true,
      })
    }

    // Create new contact
    const [newContact] = await db
      .insert(contacts)
      .values({
        email,
        name,
        phone,
        createdBy: user.id,
      })
      .returning({ id: contacts.id })

    // Log activity
    const event = contactCreatedEvent({ email, name })
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'CONTACT',
      targetId: newContact.id,
      metadata: event.metadata,
    })

    return NextResponse.json({
      ok: true,
      id: newContact.id,
      existed: false,
    })
  } catch (error) {
    console.error('Failed to create contact:', error)

    if (error instanceof Error && error.message.includes('contacts_email_key')) {
      return NextResponse.json(
        { ok: false, error: 'A contact with this email already exists.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { ok: false, error: 'Failed to create contact' },
      { status: 500 }
    )
  }
}
