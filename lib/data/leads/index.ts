import 'server-only'

import { cache } from 'react'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import { extractLeadNotes } from '@/lib/leads/notes'
import {
  LEAD_BOARD_COLUMNS,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import type { LeadSignal, PriorityTier } from '@/lib/leads/intelligence-types'
import type {
  GoogleMeetingRef,
  GoogleProposalRef,
  LeadAssigneeOption,
  LeadBoardColumnData,
  LeadRecord,
} from '@/lib/leads/types'
import { fetchAdminUsers } from '@/lib/data/users'

export const fetchLeadsBoard = cache(
  async (user: AppUser): Promise<LeadBoardColumnData[]> => {
    // Leads are admin-only - enforce at data layer for defense in depth
    assertAdmin(user)
    let rows: LeadRow[]

    try {
      rows = await selectLeadRows({ includeRank: true })
    } catch (error) {
      if (isMissingRankColumnError(error)) {
        console.warn(
          '[fetchLeadsBoard] Missing leads.rank column, falling back to createdAt ordering.'
        )
        rows = await selectLeadRows({ includeRank: false })
      } else {
        throw error
      }
    }

    const columnMap = new Map<LeadStatusValue, LeadRecord[]>(
      LEAD_BOARD_COLUMNS.map(column => [column.id, []])
    )

    rows.forEach(row => {
      const bucket = columnMap.get(row.status as LeadStatusValue)
      if (!bucket) {
        return
      }

      bucket.push({
        id: row.id,
        contactName: row.contactName,
        status: row.status as LeadStatusValue,
        sourceType: (row.sourceType as LeadRecord['sourceType']) ?? null,
        sourceDetail: row.sourceDetail ?? null,
        assigneeId: row.assigneeId ?? null,
        assigneeName: row.assigneeName ?? null,
        assigneeEmail: row.assigneeEmail ?? null,
        assigneeAvatarUrl: row.assigneeAvatarUrl ?? null,
        contactEmail: row.contactEmail ?? null,
        contactPhone: row.contactPhone ?? null,
        companyName: row.companyName ?? null,
        companyWebsite: row.companyWebsite ?? null,
        notesHtml: extractLeadNotes(row.notes),
        rank: row.rank,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        // AI Scoring
        overallScore: row.overallScore ? Number(row.overallScore) : null,
        priorityTier: (row.priorityTier as PriorityTier) ?? null,
        signals: (row.signals as LeadSignal[]) ?? [],
        lastScoredAt: row.lastScoredAt ?? null,
        // Activity Tracking
        lastContactAt: row.lastContactAt ?? null,
        awaitingReply: row.awaitingReply ?? false,
        // Predictions
        predictedCloseProbability: row.predictedCloseProbability ? Number(row.predictedCloseProbability) : null,
        estimatedValue: row.estimatedValue ? Number(row.estimatedValue) : null,
        expectedCloseDate: row.expectedCloseDate ?? null,
        // Conversion
        convertedAt: row.convertedAt ?? null,
        convertedToClientId: row.convertedToClientId ?? null,
        // Google Integrations
        googleMeetings: (row.googleMeetings as GoogleMeetingRef[]) ?? [],
        googleProposals: (row.googleProposals as GoogleProposalRef[]) ?? [],
      })
    })

    return LEAD_BOARD_COLUMNS.map(column => ({
      ...column,
      leads: columnMap.get(column.id) ?? [],
    }))
  }
)

export const fetchLeadById = cache(
  async (user: AppUser, leadId: string): Promise<LeadRecord> => {
    // Leads are admin-only - enforce at data layer for defense in depth
    assertAdmin(user)
    let rows: LeadRow[]

    try {
      rows = await selectLeadRows({
        includeRank: true,
        where: eq(leads.id, leadId),
      })
    } catch (error) {
      if (isMissingRankColumnError(error)) {
        rows = await selectLeadRows({
          includeRank: false,
          where: eq(leads.id, leadId),
        })
      } else {
        throw error
      }
    }

    if (!rows.length) {
      throw new NotFoundError('Lead not found')
    }

    const lead = rows[0]

    return {
      id: lead.id,
      contactName: lead.contactName,
      status: lead.status as LeadStatusValue,
      sourceType: (lead.sourceType as LeadRecord['sourceType']) ?? null,
      sourceDetail: lead.sourceDetail ?? null,
      assigneeId: lead.assigneeId ?? null,
      assigneeName: lead.assigneeName ?? null,
      assigneeEmail: lead.assigneeEmail ?? null,
      assigneeAvatarUrl: lead.assigneeAvatarUrl ?? null,
      contactEmail: lead.contactEmail ?? null,
      contactPhone: lead.contactPhone ?? null,
      companyName: lead.companyName ?? null,
      companyWebsite: lead.companyWebsite ?? null,
      notesHtml: extractLeadNotes(lead.notes),
      rank: lead.rank,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      // AI Scoring
      overallScore: lead.overallScore ? Number(lead.overallScore) : null,
      priorityTier: (lead.priorityTier as PriorityTier) ?? null,
      signals: (lead.signals as LeadSignal[]) ?? [],
      lastScoredAt: lead.lastScoredAt ?? null,
      // Activity Tracking
      lastContactAt: lead.lastContactAt ?? null,
      awaitingReply: lead.awaitingReply ?? false,
      // Predictions
      predictedCloseProbability: lead.predictedCloseProbability ? Number(lead.predictedCloseProbability) : null,
      estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
      expectedCloseDate: lead.expectedCloseDate ?? null,
      // Conversion
      convertedAt: lead.convertedAt ?? null,
      convertedToClientId: lead.convertedToClientId ?? null,
      // Google Integrations
      googleMeetings: (lead.googleMeetings as GoogleMeetingRef[]) ?? [],
      googleProposals: (lead.googleProposals as GoogleProposalRef[]) ?? [],
    }
  }
)

export const fetchLeadAssignees = cache(async (): Promise<LeadAssigneeOption[]> => {
  const admins = await fetchAdminUsers()

  return admins.map(admin => ({
    id: admin.id,
    name: admin.full_name ?? admin.email,
    email: admin.email,
    avatarUrl: admin.avatar_url,
  }))
})

async function selectLeadRows({
  includeRank,
  where,
}: {
  includeRank: boolean
  where?: ReturnType<typeof eq>
}) {
  const selection = {
    id: leads.id,
    contactName: leads.contactName,
    status: leads.status,
    sourceType: leads.sourceType,
    sourceDetail: leads.sourceDetail,
    assigneeId: leads.assigneeId,
    assigneeName: users.fullName,
    assigneeEmail: users.email,
    assigneeAvatarUrl: users.avatarUrl,
    contactEmail: leads.contactEmail,
    contactPhone: leads.contactPhone,
    companyName: leads.companyName,
    companyWebsite: leads.companyWebsite,
    notes: leads.notes,
    rank: includeRank ? leads.rank : sql<string>`'zzzzzzzz'`,
    createdAt: leads.createdAt,
    updatedAt: leads.updatedAt,
    // AI Scoring
    overallScore: leads.overallScore,
    priorityTier: leads.priorityTier,
    signals: leads.signals,
    lastScoredAt: leads.lastScoredAt,
    // Activity Tracking
    lastContactAt: leads.lastContactAt,
    awaitingReply: leads.awaitingReply,
    // Predictions
    predictedCloseProbability: leads.predictedCloseProbability,
    estimatedValue: leads.estimatedValue,
    expectedCloseDate: leads.expectedCloseDate,
    // Conversion
    convertedAt: leads.convertedAt,
    convertedToClientId: leads.convertedToClientId,
    // Google Integrations
    googleMeetings: leads.googleMeetings,
    googleProposals: leads.googleProposals,
  }

  return db
    .select(selection)
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assigneeId))
    .where(
      where ? and(where, isNull(leads.deletedAt)) : isNull(leads.deletedAt)
    )
    .orderBy(
      asc(leads.status),
      includeRank ? asc(leads.rank) : asc(leads.createdAt)
    )
}

function isMissingRankColumnError(error: unknown) {
  return (
    error instanceof Error &&
    /column\b.+\bleads\.rank\b.+does not exist/i.test(error.message)
  )
}

/**
 * Find a lead by contact email address.
 * Used for auto-linking incoming emails to leads.
 * Returns null if no lead found with that email.
 */
export async function getLeadByContactEmail(email: string): Promise<{
  id: string
  contactName: string
  contactEmail: string
  lastScoredAt: string | null
  lastContactAt: string | null
} | null> {
  const normalizedEmail = email.toLowerCase().trim()

  const [lead] = await db
    .select({
      id: leads.id,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
      lastScoredAt: leads.lastScoredAt,
      lastContactAt: leads.lastContactAt,
    })
    .from(leads)
    .where(
      and(
        eq(sql`lower(${leads.contactEmail})`, normalizedEmail),
        isNull(leads.deletedAt)
      )
    )
    .limit(1)

  if (!lead || !lead.contactEmail) {
    return null
  }

  return {
    id: lead.id,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    lastScoredAt: lead.lastScoredAt,
    lastContactAt: lead.lastContactAt,
  }
}

/**
 * Update a lead's scoring fields after AI scoring.
 */
export async function updateLeadScoring(
  leadId: string,
  scoring: {
    overallScore: number
    priorityTier: string
    signals: unknown[]
  }
): Promise<void> {
  const timestamp = new Date().toISOString()

  await db
    .update(leads)
    .set({
      overallScore: scoring.overallScore.toFixed(2),
      priorityTier: scoring.priorityTier,
      signals: scoring.signals,
      lastScoredAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(leads.id, leadId))
}

/**
 * Update a lead's last contact timestamp.
 */
export async function updateLeadLastContact(
  leadId: string,
  contactAt: string
): Promise<void> {
  const timestamp = new Date().toISOString()

  await db
    .update(leads)
    .set({
      lastContactAt: contactAt,
      updatedAt: timestamp,
    })
    .where(eq(leads.id, leadId))
}

type LeadRowPromise = ReturnType<typeof selectLeadRows>
type LeadRow = LeadRowPromise extends Promise<Array<infer T>> ? T : never
