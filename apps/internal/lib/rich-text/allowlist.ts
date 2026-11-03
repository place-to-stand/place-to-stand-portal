/**
 * The markup rich text (task comments, lead updates) may keep, shared by the
 * browser cleaner (`sanitizeEditorHtml`) and the server one
 * (`sanitizeRichTextHtml`), so both keep the same thing.
 *
 * Any other tag is unwrapped (its text stays), except script and style,
 * which go with their content. Only links keep an attribute: an `href` with
 * a safe protocol.
 */
export const ALLOWED_RICH_TEXT_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul',
] as const

export const RICH_TEXT_LINK_TARGET = '_blank'
export const RICH_TEXT_LINK_REL = 'noreferrer noopener'

/**
 * A link's href with a safe protocol (http, https, mailto, tel), adding
 * https:// to a bare host. Empty when the protocol is anything else
 * (javascript:, data:, vbscript:, ...).
 */
export const ensureUrlProtocol = (value: string) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''

  const hasProtocol = /^[a-zA-Z][\w+.-]*:/.test(trimmed)
  if (hasProtocol) {
    if (/^(https?|mailto|tel):/i.test(trimmed)) {
      return trimmed
    }
    return ''
  }

  return `https://${trimmed}`
}
