/**
 * Email template categories and variable tokens
 */

export const EMAIL_TEMPLATE_CATEGORIES = [
  'FOLLOW_UP',
  'PROPOSAL',
  'MEETING',
  'INTRODUCTION',
] as const

export type EmailTemplateCategory = (typeof EMAIL_TEMPLATE_CATEGORIES)[number]

export const EMAIL_TEMPLATE_CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  FOLLOW_UP: 'Follow-up',
  PROPOSAL: 'Proposal',
  MEETING: 'Meeting',
  INTRODUCTION: 'Introduction',
}

/**
 * Template variables that can be interpolated in email templates.
 * Use double curly braces in templates: {{variable_name}}
 */
export const TEMPLATE_VARIABLES = {
  contact_name: {
    label: 'Contact Name',
    description: 'Full name of the lead contact',
    example: 'Sarah Chen',
  },
  first_name: {
    label: 'First Name',
    description: 'First name only (derived from contact name)',
    example: 'Sarah',
  },
  company_name: {
    label: 'Company Name',
    description: 'Company name (empty if not set)',
    example: 'TechStartup.io',
  },
  sender_name: {
    label: 'Sender Name',
    description: 'Your full name',
    example: 'John Smith',
  },
} as const

export type TemplateVariableKey = keyof typeof TEMPLATE_VARIABLES

export const TEMPLATE_VARIABLE_KEYS = Object.keys(TEMPLATE_VARIABLES) as TemplateVariableKey[]
