import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sql, or, ilike, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts, leads, messages } from '@/lib/db/schema'

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(50).default(10),
})

export type ContactSearchResult = {
  email: string
  name: string | null
  source: 'contact' | 'lead' | 'thread'
}

export async function GET(request: Request) {
  await requireUser()

  const { searchParams } = new URL(request.url)
  const parsed = searchSchema.safeParse({
    q: searchParams.get('q'),
    limit: searchParams.get('limit'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid search query' },
      { status: 400 }
    )
  }

  const { q, limit } = parsed.data
  const searchPattern = `%${q}%`

  try {
    // Search contacts table
    const contactResults = await db
      .select({
        email: contacts.email,
        name: contacts.name,
      })
      .from(contacts)
      .where(
        sql`${contacts.deletedAt} IS NULL AND (
          ${contacts.email} ILIKE ${searchPattern} OR
          ${contacts.name} ILIKE ${searchPattern}
        )`
      )
      .limit(limit)

    // Search leads table
    const leadResults = await db
      .select({
        email: leads.contactEmail,
        name: leads.contactName,
      })
      .from(leads)
      .where(
        sql`${leads.deletedAt} IS NULL AND ${leads.contactEmail} IS NOT NULL AND (
          ${leads.contactEmail} ILIKE ${searchPattern} OR
          ${leads.contactName} ILIKE ${searchPattern}
        )`
      )
      .limit(limit)

    // Search message participants (distinct emails from recent messages)
    const messageResults = await db
      .selectDistinct({
        email: messages.fromEmail,
        name: messages.fromName,
      })
      .from(messages)
      .where(
        sql`${messages.fromEmail} ILIKE ${searchPattern} OR
            ${messages.fromName} ILIKE ${searchPattern}`
      )
      .limit(limit)

    // Combine and deduplicate results
    const seen = new Set<string>()
    const results: ContactSearchResult[] = []

    // Add contacts first (highest priority)
    for (const c of contactResults) {
      const emailLower = c.email.toLowerCase()
      if (!seen.has(emailLower)) {
        seen.add(emailLower)
        results.push({ email: c.email, name: c.name, source: 'contact' })
      }
    }

    // Add leads
    for (const l of leadResults) {
      if (!l.email) continue
      const emailLower = l.email.toLowerCase()
      if (!seen.has(emailLower)) {
        seen.add(emailLower)
        results.push({ email: l.email, name: l.name, source: 'lead' })
      }
    }

    // Add thread participants
    for (const m of messageResults) {
      const emailLower = m.email.toLowerCase()
      if (!seen.has(emailLower)) {
        seen.add(emailLower)
        results.push({ email: m.email, name: m.name, source: 'thread' })
      }
    }

    // Sort by relevance (exact email match first, then name match)
    const qLower = q.toLowerCase()
    results.sort((a, b) => {
      const aEmailMatch = a.email.toLowerCase().startsWith(qLower) ? 0 : 1
      const bEmailMatch = b.email.toLowerCase().startsWith(qLower) ? 0 : 1
      if (aEmailMatch !== bEmailMatch) return aEmailMatch - bEmailMatch

      const aNameMatch = a.name?.toLowerCase().startsWith(qLower) ? 0 : 1
      const bNameMatch = b.name?.toLowerCase().startsWith(qLower) ? 0 : 1
      return aNameMatch - bNameMatch
    })

    return NextResponse.json({
      ok: true,
      results: results.slice(0, limit),
    })
  } catch (err) {
    console.error('Contact search error:', err)
    return NextResponse.json(
      { ok: false, error: 'Search failed' },
      { status: 500 }
    )
  }
}
