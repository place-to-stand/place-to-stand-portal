import type {
  TemplateContext,
  LeadTemplateData,
  SenderTemplateData,
} from './types'

/**
 * Interpolate template variables in a string.
 * Replaces {{variable_name}} with corresponding values from context.
 * Missing variables are replaced with empty strings.
 *
 * @example
 * interpolate('Hello {{first_name}}!', { first_name: 'Sarah' })
 * // => 'Hello Sarah!'
 */
export function interpolate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key as keyof TemplateContext]
    return value ?? ''
  })
}

/**
 * Build template context from lead and sender data
 */
export function buildTemplateContext(
  lead: LeadTemplateData,
  sender: SenderTemplateData
): TemplateContext {
  const firstName = extractFirstName(lead.contactName)

  return {
    contact_name: lead.contactName,
    first_name: firstName,
    company_name: lead.companyName ?? '',
    sender_name: sender.fullName,
  }
}

/**
 * Extract first name from full name
 */
function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim()
  const firstSpace = trimmed.indexOf(' ')

  if (firstSpace === -1) {
    return trimmed
  }

  return trimmed.slice(0, firstSpace)
}

/**
 * Preview a template with sample data (for template editor)
 */
export function previewTemplate(
  template: string,
  lead?: Partial<LeadTemplateData>,
  sender?: Partial<SenderTemplateData>
): string {
  const context: TemplateContext = {
    contact_name: lead?.contactName ?? 'Contact Name',
    first_name: lead?.contactName ? extractFirstName(lead.contactName) : 'Contact',
    company_name: lead?.companyName ?? 'Company',
    sender_name: sender?.fullName ?? 'Your Name',
  }

  return interpolate(template, context)
}
