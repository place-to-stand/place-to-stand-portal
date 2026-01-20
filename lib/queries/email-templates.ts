'use server'

import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { emailTemplates } from '@/lib/db/schema'
import type { EmailTemplateCategory } from '@/lib/email/templates'

/**
 * Fetch all active email templates
 */
export async function fetchEmailTemplates() {
  return db
    .select()
    .from(emailTemplates)
    .where(isNull(emailTemplates.deletedAt))
    .orderBy(emailTemplates.category, desc(emailTemplates.isDefault), emailTemplates.name)
}

/**
 * Fetch email templates by category
 */
export async function fetchEmailTemplatesByCategory(category: EmailTemplateCategory) {
  return db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.category, category),
        isNull(emailTemplates.deletedAt)
      )
    )
    .orderBy(desc(emailTemplates.isDefault), emailTemplates.name)
}

/**
 * Fetch a single email template by ID
 */
export async function fetchEmailTemplateById(id: string) {
  const rows = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Fetch the default template for a category
 */
export async function fetchDefaultTemplate(category: EmailTemplateCategory) {
  const rows = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.category, category),
        eq(emailTemplates.isDefault, true),
        isNull(emailTemplates.deletedAt)
      )
    )
    .limit(1)

  return rows[0] ?? null
}

/**
 * Create a new email template
 */
export async function createEmailTemplate(input: {
  name: string
  category: EmailTemplateCategory
  subject: string
  bodyHtml: string
  bodyText?: string | null
  isDefault?: boolean
  createdBy: string
}) {
  const now = new Date().toISOString()

  // If this is marked as default, unset other defaults in same category
  if (input.isDefault) {
    await db
      .update(emailTemplates)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(
          eq(emailTemplates.category, input.category),
          eq(emailTemplates.isDefault, true),
          isNull(emailTemplates.deletedAt)
        )
      )
  }

  const rows = await db
    .insert(emailTemplates)
    .values({
      name: input.name,
      category: input.category,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText ?? null,
      isDefault: input.isDefault ?? false,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return rows[0]
}

/**
 * Update an existing email template
 */
export async function updateEmailTemplate(
  id: string,
  input: {
    name?: string
    category?: EmailTemplateCategory
    subject?: string
    bodyHtml?: string
    bodyText?: string | null
    isDefault?: boolean
  }
) {
  const now = new Date().toISOString()

  // If setting as default, first unset other defaults in same category
  if (input.isDefault && input.category) {
    await db
      .update(emailTemplates)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(
          eq(emailTemplates.category, input.category),
          eq(emailTemplates.isDefault, true),
          isNull(emailTemplates.deletedAt)
        )
      )
  }

  const rows = await db
    .update(emailTemplates)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.bodyHtml !== undefined && { bodyHtml: input.bodyHtml }),
      ...(input.bodyText !== undefined && { bodyText: input.bodyText }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      updatedAt: now,
    })
    .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
    .returning()

  return rows[0] ?? null
}

/**
 * Soft-delete an email template
 */
export async function deleteEmailTemplate(id: string) {
  const now = new Date().toISOString()

  const rows = await db
    .update(emailTemplates)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
    .returning({ id: emailTemplates.id })

  return rows.length > 0
}
