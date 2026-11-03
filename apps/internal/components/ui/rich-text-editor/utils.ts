import DOMPurify from 'dompurify'

import {
  ALLOWED_RICH_TEXT_TAGS,
  RICH_TEXT_LINK_REL,
  RICH_TEXT_LINK_TARGET,
  ensureUrlProtocol,
} from '@/lib/rich-text/allowlist'

export { ensureUrlProtocol }

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

      if (
        !Number.isFinite(codePoint) ||
        codePoint < 1 ||
        codePoint > 0x10ffff
      ) {
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

const purify = (content: string) => {
  // Hooks are global to the DOMPurify instance, so add and remove ours
  // around each call.
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName !== 'A') return
    const href = ensureUrlProtocol(node.getAttribute('href') ?? '')
    if (!href) {
      node.removeAttribute('href')
      return
    }
    node.setAttribute('href', href)
    node.setAttribute('target', RICH_TEXT_LINK_TARGET)
    node.setAttribute('rel', RICH_TEXT_LINK_REL)
  })
  try {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [...ALLOWED_RICH_TEXT_TAGS],
      ALLOWED_ATTR: ['href'],
      ALLOW_DATA_ATTR: false,
    })
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes')
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
    return purify(content)
  } catch (error) {
    console.warn('Failed to sanitize rich text content', error)
    return toEscapedText(content)
  }
}
