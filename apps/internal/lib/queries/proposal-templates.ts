'use server'

import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { proposalTemplates, proposalTemplateType } from '@/lib/db/schema'
import type { TermsSection } from '@/lib/proposals/types'

// Infer the type from the enum
export type ProposalTemplateType = (typeof proposalTemplateType.enumValues)[number]

// Record type returned from queries
export type ProposalTemplateRecord = {
  id: string
  name: string
  type: ProposalTemplateType
  content: TermsSection[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/**
 * Fetch all active proposal templates, optionally filtered by type
 */
export async function fetchProposalTemplates(
  type?: ProposalTemplateType
): Promise<ProposalTemplateRecord[]> {
  const conditions = [isNull(proposalTemplates.deletedAt)]

  if (type) {
    conditions.push(eq(proposalTemplates.type, type))
  }

  const rows = await db
    .select()
    .from(proposalTemplates)
    .where(and(...conditions))
    .orderBy(proposalTemplates.type, desc(proposalTemplates.isDefault), proposalTemplates.name)

  return rows.map(row => ({
    ...row,
    content: row.content as TermsSection[],
  }))
}

/**
 * Fetch the default proposal template for a given type
 */
export async function fetchDefaultProposalTemplate(
  type: ProposalTemplateType
): Promise<ProposalTemplateRecord | null> {
  const rows = await db
    .select()
    .from(proposalTemplates)
    .where(
      and(
        eq(proposalTemplates.type, type),
        eq(proposalTemplates.isDefault, true),
        isNull(proposalTemplates.deletedAt)
      )
    )
    .limit(1)

  if (!rows[0]) return null

  return {
    ...rows[0],
    content: rows[0].content as TermsSection[],
  }
}

/**
 * Fetch a single proposal template by ID
 */
export async function fetchProposalTemplateById(
  id: string
): Promise<ProposalTemplateRecord | null> {
  const rows = await db
    .select()
    .from(proposalTemplates)
    .where(and(eq(proposalTemplates.id, id), isNull(proposalTemplates.deletedAt)))
    .limit(1)

  if (!rows[0]) return null

  return {
    ...rows[0],
    content: rows[0].content as TermsSection[],
  }
}

/**
 * Create a new proposal template
 */
export async function createProposalTemplate(input: {
  name: string
  type: ProposalTemplateType
  content: TermsSection[]
  isDefault?: boolean
}): Promise<ProposalTemplateRecord | null> {
  const now = new Date().toISOString()

  // If this is marked as default, unset other defaults of the same type
  if (input.isDefault) {
    await db
      .update(proposalTemplates)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(
          eq(proposalTemplates.type, input.type),
          eq(proposalTemplates.isDefault, true),
          isNull(proposalTemplates.deletedAt)
        )
      )
  }

  const rows = await db
    .insert(proposalTemplates)
    .values({
      name: input.name,
      type: input.type,
      content: input.content,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  if (!rows[0]) return null

  return {
    ...rows[0],
    content: rows[0].content as TermsSection[],
  }
}

/**
 * Update an existing proposal template
 */
export async function updateProposalTemplate(
  id: string,
  input: {
    name?: string
    type?: ProposalTemplateType
    content?: TermsSection[]
    isDefault?: boolean
  }
): Promise<ProposalTemplateRecord | null> {
  const now = new Date().toISOString()

  // If setting as default, first unset other defaults of the same type
  if (input.isDefault && input.type) {
    await db
      .update(proposalTemplates)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(
          eq(proposalTemplates.type, input.type),
          eq(proposalTemplates.isDefault, true),
          isNull(proposalTemplates.deletedAt)
        )
      )
  }

  const rows = await db
    .update(proposalTemplates)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      updatedAt: now,
    })
    .where(and(eq(proposalTemplates.id, id), isNull(proposalTemplates.deletedAt)))
    .returning()

  if (!rows[0]) return null

  return {
    ...rows[0],
    content: rows[0].content as TermsSection[],
  }
}

/**
 * Soft-delete a proposal template
 */
export async function deleteProposalTemplate(id: string): Promise<boolean> {
  const now = new Date().toISOString()

  const rows = await db
    .update(proposalTemplates)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(proposalTemplates.id, id), isNull(proposalTemplates.deletedAt)))
    .returning({ id: proposalTemplates.id })

  return rows.length > 0
}

/**
 * Set a template as the default for its type (and unset others)
 */
export async function setDefaultProposalTemplate(
  id: string,
  type: ProposalTemplateType
): Promise<boolean> {
  const now = new Date().toISOString()

  // Unset any existing defaults of this type
  await db
    .update(proposalTemplates)
    .set({ isDefault: false, updatedAt: now })
    .where(
      and(
        eq(proposalTemplates.type, type),
        eq(proposalTemplates.isDefault, true),
        isNull(proposalTemplates.deletedAt)
      )
    )

  // Set this one as default
  const rows = await db
    .update(proposalTemplates)
    .set({ isDefault: true, updatedAt: now })
    .where(and(eq(proposalTemplates.id, id), isNull(proposalTemplates.deletedAt)))
    .returning({ id: proposalTemplates.id })

  return rows.length > 0
}
