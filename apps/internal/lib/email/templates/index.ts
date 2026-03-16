export {
  EMAIL_TEMPLATE_CATEGORIES,
  EMAIL_TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_KEYS,
  type EmailTemplateCategory,
  type TemplateVariableKey,
} from './constants'

export {
  type EmailTemplateRecord,
  type EmailTemplateInput,
  type TemplateContext,
  type LeadTemplateData,
  type SenderTemplateData,
} from './types'

export {
  interpolate,
  buildTemplateContext,
  previewTemplate,
} from './interpolate'
