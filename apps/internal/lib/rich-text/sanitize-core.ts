import sanitizeHtml from 'sanitize-html'

import {
  ALLOWED_RICH_TEXT_TAGS,
  cleanRichTextAttributes,
  RICH_TEXT_LINK_REL,
  RICH_TEXT_LINK_TARGET,
  ensureUrlProtocol,
} from './allowlist'

/** Keeps only what `cleanRichTextAttributes` allows for the tag. */
const cleanTag = (tagName: string, attribs: sanitizeHtml.Attributes) => ({
  tagName,
  attribs: cleanRichTextAttributes(tagName, attribs) ?? {},
})

const ALIGNABLE_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_RICH_TEXT_TAGS],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    ...Object.fromEntries(ALIGNABLE_TAGS.map(tag => [tag, ['style']])),
    mark: ['data-color', 'style'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    input: ['type', 'checked'],
  },
  // Styles were already cut down to alignment and highlight colour by
  // `cleanRichTextAttributes`; this is the same list as a second fence.
  allowedStyles: {
    '*': { 'text-align': [/^(left|center|right|justify)$/] },
    mark: {
      'background-color': [
        /^(var\(--tt-(color-highlight-[a-z]+|bg-color)\)|#[0-9a-f]{3,8})$/i,
      ],
      color: [/^inherit$/],
    },
  },
  // An input that isn't a checkbox goes, with nothing to keep.
  exclusiveFilter: frame =>
    frame.tag === 'input' &&
    cleanRichTextAttributes('input', frame.attribs) === null,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    ...Object.fromEntries(
      [...ALIGNABLE_TAGS, 'mark', 'ul', 'li', 'input'].map(tag => [
        tag,
        cleanTag,
      ])
    ),
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
 * The server cleaner without the `server-only` guard, so tests can load it.
 * Import `sanitizeRichTextHtml` from `./sanitize-server` in app code.
 *
 * Cleans rich text before it is stored, whoever wrote it (the portal, the
 * CLI or MCP). Display cleans again in the browser; this keeps stored rows
 * safe for any future renderer that forgets to.
 */
export const sanitizeRichTextHtmlCore = (content: string) =>
  sanitizeHtml(content, OPTIONS)
