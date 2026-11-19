/** The kinds of template under Reference → Templates, each its own page. */
export const TEMPLATE_KINDS = [
  { label: 'Emails', value: 'emails', href: '/reference/templates/emails' },
  { label: 'PDFs', value: 'pdfs', href: '/reference/templates/pdfs' },
  {
    label: 'Chat messages',
    value: 'chat',
    href: '/reference/templates/chat',
  },
] as const

export type TemplateKind = (typeof TEMPLATE_KINDS)[number]['value']
