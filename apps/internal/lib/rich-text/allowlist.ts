/**
 * The markup rich text (task comments, lead updates) may keep, shared by the
 * browser cleaner (`sanitizeEditorHtml`) and the server one
 * (`sanitizeRichTextHtml`), so both keep the same thing.
 *
 * Any other tag is unwrapped (its text stays), except script and style,
 * which go with their content. Attributes are kept only where the editor
 * needs them to read the content back (`cleanRichTextAttributes`): a link's
 * safe `href`, a highlight's colour, a paragraph's or heading's alignment,
 * and a checklist's markers and ticks. Everything the toolbar can make
 * survives a save.
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
  'div',
  'input',
  'label',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul',
] as const

/** Every attribute name any tag may keep; values are checked below. */
export const ALLOWED_RICH_TEXT_ATTRIBUTES = [
  'checked',
  'data-checked',
  'data-color',
  'data-type',
  'href',
  'style',
  'type',
] as const

const ALIGNABLE = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify'])

/**
 * A highlight colour: the toolbar's palette (`var(--tt-color-highlight-*)`,
 * or `--tt-bg-color` for none) or a plain hex colour from older content.
 */
const HIGHLIGHT_COLOR =
  /^(var\(--tt-(color-highlight-[a-z]+|bg-color)\)|#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8}))$/i

/** `a: b; c: d` as lower-cased property → trimmed value pairs. */
function parseStyle(style: string): Map<string, string> {
  const declarations = new Map<string, string>()
  for (const part of style.split(';')) {
    const colon = part.indexOf(':')
    if (colon === -1) continue
    const property = part.slice(0, colon).trim().toLowerCase()
    const value = part.slice(colon + 1).trim()
    if (property && value) declarations.set(property, value)
  }
  return declarations
}

/**
 * The attributes `tag` may keep, rebuilt from scratch so nothing else gets
 * through, or null when the element must go (an `input` that isn't a
 * checkbox). Shared by the browser and server cleaners.
 *
 * Links are left to each cleaner (they also add target and rel).
 */
export function cleanRichTextAttributes(
  tag: string,
  attributes: Record<string, string | undefined>
): Record<string, string> | null {
  const name = tag.toLowerCase()
  const out: Record<string, string> = {}

  if (ALIGNABLE.has(name) && attributes.style) {
    const align = parseStyle(attributes.style).get('text-align')?.toLowerCase()
    if (align && ALIGNMENTS.has(align)) out.style = `text-align: ${align}`
  }

  if (name === 'mark') {
    const color =
      attributes['data-color'] ??
      (attributes.style
        ? parseStyle(attributes.style).get('background-color')
        : undefined)
    if (color && HIGHLIGHT_COLOR.test(color)) {
      out['data-color'] = color
      out.style = `background-color: ${color}; color: inherit`
    }
  }

  if (name === 'ul' && attributes['data-type'] === 'taskList') {
    out['data-type'] = 'taskList'
  }

  if (name === 'li' && attributes['data-type'] === 'taskItem') {
    out['data-type'] = 'taskItem'
    out['data-checked'] =
      attributes['data-checked'] === 'true' ? 'true' : 'false'
  }

  if (name === 'input') {
    if (attributes.type?.toLowerCase() !== 'checkbox') return null
    out.type = 'checkbox'
    if (attributes.checked !== undefined) out.checked = 'checked'
  }

  return out
}

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
