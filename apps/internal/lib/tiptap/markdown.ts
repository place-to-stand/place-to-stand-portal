import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'

/**
 * Lines that only Markdown starts this way: a heading, a bullet (checklist
 * items included), a numbered item or a quote.
 */
const BLOCK_MARKER = /^\s{0,12}(#{1,6}\s+\S|[-*+]\s+\S|\d{1,9}[.)]\s+\S|>\s)/m

/** A code fence counts only with its closing fence. */
const FENCE_LINE = /^\s{0,3}(```|~~~)/gm

/**
 * Inline marks that read as Markdown: **bold**, [text](url), `code`,
 * ~~strike~~. Not `__x__`, which is every Python `__init__`.
 */
const INLINE_MARKER =
  /\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\)|`[^`\n]+`|~~[^~\n]+~~/

/**
 * Copied HTML that already says how the text looks: a web page, Google Docs
 * (`<b id="docs-internal-guid…">`, `font-weight:700` spans), Word (`Mso…`
 * classes), or a code editor (VS Code copies monospace `white-space: pre`
 * divs). The editor keeps its normal paste for all of them, so only bare
 * text (a terminal, a chat app's copy button, a plain text file) is read as
 * Markdown.
 */
const FORMATTED_HTML =
  /<(ul|ol|li|h[1-6]|blockquote|pre|table|strong|b|em|i|u|a|code|s|del|mark|img)\b|font-weight:\s*(bold|[6-9]00)|font-style:\s*italic|white-space:\s*pre|monospace|class="?Mso|urn:schemas-microsoft-com/i

/** Whether a paste should be read as Markdown rather than plain text. */
export function isMarkdownPaste(text: string, html: string | null): boolean {
  if (!text.trim()) return false
  if (html && FORMATTED_HTML.test(html)) return false
  const fences = text.match(FENCE_LINE)?.length ?? 0
  return fences >= 2 || BLOCK_MARKER.test(text) || INLINE_MARKER.test(text)
}

const LIST_ITEM_LINE = /^\s*([-*+]|\d{1,9}[.)])\s+\S/
const FENCE_START = /^\s{0,3}(```|~~~)/

/**
 * Plain text keeps its line breaks. Markdown would fold a line written
 * straight after a list item into that item ("Thanks" after "2. close"),
 * and run single lines of an address into one; a blank line before the
 * first and hard breaks for the second keep what the writer typed.
 */
function keepLineBreaks(text: string): string {
  const out: string[] = []
  let inFence = false
  let previousWasItem = false
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE_START.test(line)) {
      inFence = !inFence
      previousWasItem = false
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }
    const isItem = LIST_ITEM_LINE.test(line)
    const isIndented = /^\s/.test(line)
    if (previousWasItem && line.trim() && !isItem && !isIndented) {
      out.push('')
    }
    out.push(line)
    if (line.trim()) previousWasItem = isItem || (previousWasItem && isIndented)
  }
  return out.join('\n')
}

/**
 * Markdown (with GitHub's tables, strikethrough, task lists and autolinks)
 * as HTML. Raw HTML in the text is escaped, never passed through.
 */
export function markdownToHtml(text: string): string {
  return (
    micromark(keepLineBreaks(text), {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
    })
      // A fenced block ends with a newline, which the editor would show as a
      // blank last line.
      .replace(/\n<\/code><\/pre>/g, '</code></pre>')
      // A single line break inside a paragraph stays a line break.
      .replace(
        /<p>([\s\S]*?)<\/p>/g,
        (_match, body: string) => `<p>${body.replace(/\n/g, '<br />')}</p>`
      )
  )
}
