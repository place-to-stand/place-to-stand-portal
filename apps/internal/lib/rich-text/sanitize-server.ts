import 'server-only'

import sanitizeHtml from 'sanitize-html'

import {
  ALLOWED_RICH_TEXT_TAGS,
  RICH_TEXT_LINK_REL,
  RICH_TEXT_LINK_TARGET,
  ensureUrlProtocol,
} from './allowlist'

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_RICH_TEXT_TAGS],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // A link with an unsafe href becomes a bare span: its text stays.
    a: (_tagName, attribs): sanitizeHtml.Tag => {
      const href = ensureUrlProtocol(attribs.href ?? '')
      if (!href) return { tagName: 'span', attribs: {} }
      return {
        tagName: 'a',
        attribs: {
          href,
          target: RICH_TEXT_LINK_TARGET,
          rel: RICH_TEXT_LINK_REL,
        },
      }
    },
  },
}

/**
 * Cleans rich text before it is stored, whoever wrote it (the portal, the
 * CLI or MCP). Display cleans again in the browser; this keeps stored rows
 * safe for any future renderer that forgets to.
 */
export const sanitizeRichTextHtml = (content: string) =>
  sanitizeHtml(content, OPTIONS)
