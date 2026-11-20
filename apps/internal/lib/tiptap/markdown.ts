import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'

/**
 * Lines that only Markdown starts this way: a heading, a bullet, a numbered
 * item, a quote, a code fence or a checklist item.
 */
const BLOCK_MARKER =
  /^\s{0,12}(#{1,6}\s+\S|[-*+]\s+\S|\d{1,9}[.)]\s+\S|>\s|```|~~~)/m

/** Inline marks that read as Markdown: **bold**, [text](url), `code`, ~~strike~~. */
const INLINE_MARKER =
  /\*\*[^*\n]+\*\*|__[^_\n]+__|\[[^\]\n]+\]\([^)\s]+\)|`[^`\n]+`|~~[^~\n]+~~/

/**
 * Formatting that the copied HTML already carries. When it has any, the
 * source app formatted the text itself (a web page, Google Docs, another
 * editor) and the editor keeps its normal paste. A code editor (VS Code)
 * copies only coloured spans and divs, which carry no meaning, so its
 * Markdown is still converted.
 */
const STRUCTURAL_HTML =
  /<(ul|ol|li|h[1-6]|blockquote|pre|table|strong|em|a|code|s|del|mark)\b/i

/** Whether a paste should be read as Markdown rather than plain text. */
export function isMarkdownPaste(text: string, html: string | null): boolean {
  if (!text.trim()) return false
  if (html && STRUCTURAL_HTML.test(html)) return false
  return BLOCK_MARKER.test(text) || INLINE_MARKER.test(text)
}

/**
 * Markdown (with GitHub's tables, strikethrough, task lists and autolinks)
 * as HTML. Raw HTML in the text is escaped, never passed through.
 */
export function markdownToHtml(text: string): string {
  return (
    micromark(text, {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
    })
      // A fenced block ends with a newline, which the editor would show as a
      // blank last line.
      .replace(/\n<\/code><\/pre>/g, '</code></pre>')
  )
}
