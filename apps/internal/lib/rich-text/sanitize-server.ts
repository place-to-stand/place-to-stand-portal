import 'server-only'

import { sanitizeRichTextHtmlCore } from './sanitize-core'

/**
 * Cleans rich text before it is stored, whoever wrote it (the portal, the
 * CLI or MCP). Display cleans again in the browser; this keeps stored rows
 * safe for any future renderer that forgets to.
 */
export const sanitizeRichTextHtml = sanitizeRichTextHtmlCore
