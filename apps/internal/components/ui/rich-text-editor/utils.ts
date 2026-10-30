const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

/**
 * Single-pass entity decode, so `&amp;lt;` correctly lands on the literal
 * `&lt;` the author typed rather than being decoded twice into `<`.
 */
const decodeHtmlEntities = (content: string) =>
  content.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const codePoint =
        entity[1]?.toLowerCase() === 'x'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10)

      if (!Number.isFinite(codePoint) || codePoint < 1 || codePoint > 0x10ffff) {
        return match
      }

      return String.fromCodePoint(codePoint)
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })

/**
 * Flattens editor HTML to the text a reader would see. Entities are decoded
 * *after* tags are stripped: escaped markup like `&lt;script&gt;` is content
 * the author wrote, so it must survive tag removal and then read as `<script>`
 * \u2014 decoding first would turn it into a tag and delete it.
 */
export const richTextToPlainText = (content: string) =>
  decodeHtmlEntities(
    content
      .replace(/<br\s*\/?>(\s|&nbsp;|\u00a0)*/gi, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()

export const isContentEmpty = (content: string) =>
  richTextToPlainText(content).length === 0

export const ensureUrlProtocol = (value: string) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''

  const hasProtocol = /^[a-zA-Z][\w+.-]*:/.test(trimmed)
  if (hasProtocol) {
    // Only allow safe protocols — reject javascript:, data:, vbscript:, etc.
    if (/^(https?|mailto|tel):/i.test(trimmed)) {
      return trimmed
    }
    return ''
  }

  return `https://${trimmed}`
}

// Allowlist the minimal tags produced by the editor to prevent unsafe markup.
const ALLOWED_RICH_TEXT_TAGS = new Set([
  'A',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'EM',
  'HR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'SPAN',
  'STRONG',
  'U',
  'UL',
])

const unwrapElement = (element: Element) => {
  const parent = element.parentNode
  if (!parent) {
    element.remove()
    return
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }

  parent.removeChild(element)
}

const sanitizeElement = (element: Element) => {
  if (element.tagName === 'A') {
    const href = element.getAttribute('href') ?? ''
    const safeHref = ensureUrlProtocol(href)
    if (!safeHref) {
      unwrapElement(element)
      return
    }

    element.setAttribute('href', safeHref)
    element.setAttribute('target', '_blank')
    element.setAttribute('rel', 'noreferrer noopener')

    const allowedAttributes = new Set(['href', 'target', 'rel'])
    Array.from(element.attributes).forEach(attribute => {
      if (!allowedAttributes.has(attribute.name)) {
        element.removeAttribute(attribute.name)
      }
    })
  } else {
    Array.from(element.attributes).forEach(attribute => {
      element.removeAttribute(attribute.name)
    })
  }
}

const sanitizeNode = (node: Node) => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    // Taken first: an unwrapped element's children move to its parent, past
    // the parent's own walk, so they are sanitized here.
    const children = Array.from(element.childNodes)
    if (!ALLOWED_RICH_TEXT_TAGS.has(element.tagName)) {
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
        element.remove()
        return
      }
      unwrapElement(element)
    } else {
      sanitizeElement(element)
    }

    children.forEach(sanitizeNode)
    return
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node)
  }
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Fails closed: the content as escaped plain text, never raw markup. */
const toEscapedText = (content: string) =>
  escapeHtml(richTextToPlainText(content))

export const sanitizeEditorHtml = (content: string) => {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // No DOMParser (SSR): render the text only, escaped. A tag-stripping
    // regex isn't safe here (e.g. `<<img src=x onerror=...>` survives it).
    return toEscapedText(content)
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const { body } = doc

    Array.from(body.childNodes).forEach(sanitizeNode)

    return body.innerHTML
  } catch (error) {
    console.warn('Failed to sanitize rich text content', error)
    return toEscapedText(content)
  }
}
