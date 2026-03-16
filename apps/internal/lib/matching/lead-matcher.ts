import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts, contactLeads, leads } from '@/lib/db/schema'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MatchConfidence = 'HIGH' | 'MEDIUM'
export type MatchSource = 'DIRECT_EMAIL' | 'CONTACT_EMAIL' | 'DOMAIN'

export type LeadMatchCandidate = {
  leadId: string
  contactName: string
  matchedEmail: string
  confidence: MatchConfidence
  matchSource: MatchSource
}

export type LeadRoutingResult = {
  candidates: LeadMatchCandidate[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
])

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalize(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

function extractDomain(email: string): string {
  const idx = email.indexOf('@')
  return idx >= 0 ? email.slice(idx + 1) : ''
}

// ─────────────────────────────────────────────────────────────────────────────
// Core matching engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a set of participant emails against all leads.
 * Returns ALL candidate leads with confidence scores — never auto-links.
 *
 * Matching tiers (all run, results aggregated):
 *   1. `leads.contactEmail` exact match → HIGH / DIRECT_EMAIL
 *   2. `contact_leads → contacts.email` exact match → HIGH / CONTACT_EMAIL
 *   3. Domain match via `contact_leads → contacts.email` (excl. free providers) → MEDIUM / DOMAIN
 *
 * Results are deduplicated by leadId (highest confidence wins).
 */
export async function matchEmailsToLeads(
  participantEmails: string[]
): Promise<LeadRoutingResult> {
  const normalized = participantEmails.map(normalize).filter(Boolean)
  if (normalized.length === 0) return { candidates: [] }

  const candidateMap = new Map<string, LeadMatchCandidate>()

  // ── Tier 1: Direct lead.contactEmail match ──────────────────────────────
  const directMatches = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
    })
    .from(leads)
    .where(
      and(
        sql`lower(${leads.contactEmail}) = ANY(${normalized})`,
        isNull(leads.deletedAt)
      )
    )

  for (const lead of directMatches) {
    if (!lead.contactEmail) continue
    candidateMap.set(lead.id, {
      leadId: lead.id,
      contactName: lead.contactName,
      matchedEmail: lead.contactEmail.toLowerCase(),
      confidence: 'HIGH',
      matchSource: 'DIRECT_EMAIL',
    })
  }

  // ── Tier 2: Exact match via contact_leads → contacts ────────────────────
  const contactExactMatches = await db
    .select({
      leadId: contactLeads.leadId,
      contactEmail: contacts.email,
      contactName: contacts.name,
    })
    .from(contactLeads)
    .innerJoin(contacts, eq(contacts.id, contactLeads.contactId))
    .innerJoin(leads, eq(leads.id, contactLeads.leadId))
    .where(
      and(
        sql`lower(${contacts.email}) = ANY(${normalized})`,
        isNull(contacts.deletedAt),
        isNull(leads.deletedAt)
      )
    )

  for (const match of contactExactMatches) {
    // Don't overwrite a DIRECT_EMAIL match (higher specificity)
    if (!candidateMap.has(match.leadId)) {
      candidateMap.set(match.leadId, {
        leadId: match.leadId,
        contactName: match.contactName,
        matchedEmail: match.contactEmail.toLowerCase(),
        confidence: 'HIGH',
        matchSource: 'CONTACT_EMAIL',
      })
    }
  }

  // ── Tier 3: Domain match via contact_leads (exclude free email) ─────────
  const participantDomains = Array.from(
    new Set(
      normalized
        .map(extractDomain)
        .filter(d => d && !FREE_EMAIL_DOMAINS.has(d))
    )
  )

  if (participantDomains.length > 0) {
    const domainMatches = await db
      .select({
        leadId: contactLeads.leadId,
        contactEmail: contacts.email,
        contactName: contacts.name,
      })
      .from(contactLeads)
      .innerJoin(contacts, eq(contacts.id, contactLeads.contactId))
      .innerJoin(leads, eq(leads.id, contactLeads.leadId))
      .where(
        and(
          sql`split_part(lower(${contacts.email}), '@', 2) = ANY(${participantDomains})`,
          isNull(contacts.deletedAt),
          isNull(leads.deletedAt)
        )
      )

    for (const match of domainMatches) {
      if (!candidateMap.has(match.leadId)) {
        candidateMap.set(match.leadId, {
          leadId: match.leadId,
          contactName: match.contactName,
          matchedEmail: match.contactEmail.toLowerCase(),
          confidence: 'MEDIUM',
          matchSource: 'DOMAIN',
        })
      }
    }

    // Also check domain match against leads.contactEmail directly
    const directDomainMatches = await db
      .select({
        id: leads.id,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
      })
      .from(leads)
      .where(
        and(
          sql`split_part(lower(${leads.contactEmail}), '@', 2) = ANY(${participantDomains})`,
          isNull(leads.deletedAt)
        )
      )

    for (const lead of directDomainMatches) {
      if (!lead.contactEmail) continue
      if (!candidateMap.has(lead.id)) {
        candidateMap.set(lead.id, {
          leadId: lead.id,
          contactName: lead.contactName,
          matchedEmail: lead.contactEmail.toLowerCase(),
          confidence: 'MEDIUM',
          matchSource: 'DOMAIN',
        })
      }
    }
  }

  return { candidates: Array.from(candidateMap.values()) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead contact email helpers (reused by proposal context + suggestions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get ALL email addresses associated with a lead:
 *   - `leads.contactEmail` (primary)
 *   - All emails from `contact_leads → contacts.email`
 *
 * Returns normalized (lowercased, trimmed), deduplicated array.
 */
export async function getLeadContactEmails(leadId: string): Promise<string[]> {
  const [lead, contactRows] = await Promise.all([
    db
      .select({ contactEmail: leads.contactEmail })
      .from(leads)
      .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
      .limit(1)
      .then(rows => rows[0]),
    db
      .select({ email: contacts.email })
      .from(contactLeads)
      .innerJoin(contacts, eq(contacts.id, contactLeads.contactId))
      .where(
        and(
          eq(contactLeads.leadId, leadId),
          isNull(contacts.deletedAt)
        )
      ),
  ])

  const emails = new Set<string>()

  if (lead?.contactEmail) {
    emails.add(normalize(lead.contactEmail))
  }

  for (const row of contactRows) {
    const email = normalize(row.email)
    if (email) emails.add(email)
  }

  return Array.from(emails)
}

/**
 * Match meeting attendees to leads. Thin wrapper over `matchEmailsToLeads`.
 */
export async function matchMeetingToLeads(
  attendeeEmails: string[]
): Promise<LeadRoutingResult> {
  return matchEmailsToLeads(attendeeEmails)
}
