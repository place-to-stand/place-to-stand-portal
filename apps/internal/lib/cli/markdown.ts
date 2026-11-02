/**
 * The inline markdown CLI text may use: **bold**, *italic* and
 * [text](https://…). Everything else is escaped as text, so nothing pasted
 * can inject markup.
 */

const SAFE_HREF = /^(https?:\/\/|mailto:)/i

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Inline markdown only, whitespace left as-is. For callers that assemble a
 * line from fragments (e.g. around code spans) and need spaces preserved.
 */
export function inlineMarkdown(text: string): string {
  let out = escapeHtml(text)
  // Links first so their text can carry emphasis without re-parsing the href.
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (match, label: string, href: string) =>
      SAFE_HREF.test(href) ? `<a href="${href}">${label}</a>` : match
  )
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return out
}
