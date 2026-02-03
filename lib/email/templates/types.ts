import type { EmailTemplateCategory, TemplateVariableKey } from './constants'

/**
 * Email template record from database
 */
export type EmailTemplateRecord = {
  id: string
  name: string
  category: EmailTemplateCategory
  subject: string
  bodyHtml: string
  bodyText: string | null
  isDefault: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/**
 * Input for creating/updating a template
 */
export type EmailTemplateInput = {
  name: string
  category: EmailTemplateCategory
  subject: string
  bodyHtml: string
  bodyText?: string | null
  isDefault?: boolean
}

/**
 * Context for template variable interpolation
 */
export type TemplateContext = {
  [K in TemplateVariableKey]?: string
}

/**
 * Lead data used to build template context
 */
export type LeadTemplateData = {
  contactName: string
  companyName?: string | null
}

/**
 * User data used to build template context
 */
export type SenderTemplateData = {
  fullName: string
}
