/**
 * Convert TipTap HTML output to plain text, preserving structure.
 * This is a simple conversion that maintains readability in Google Docs.
 *
 * Future enhancement: Map HTML formatting to Google Docs API styles.
 */
export function htmlToPlainText(html: string): string {
  if (!html || html === '<p></p>') {
    return ''
  }

  let text = html

  // Convert paragraph breaks to double newlines
  text = text.replace(/<\/p>\s*<p>/gi, '\n\n')

  // Convert line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n')

  // Convert list items to bullet points
  text = text.replace(/<li>/gi, '• ')
  text = text.replace(/<\/li>/gi, '\n')

  // Convert headers to uppercase with spacing
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_, content) => {
    return `\n${stripTags(content).toUpperCase()}\n`
  })

  // Convert blockquotes to indented text
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (_, content) => {
    const stripped = stripTags(content)
    return stripped.split('\n').map(line => `  > ${line}`).join('\n')
  })

  // Remove all remaining HTML tags
  text = stripTags(text)

  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n')

  // Trim whitespace
  text = text.trim()

  return text
}

/**
 * Strip HTML tags from a string
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Check if content is just empty paragraphs from TipTap
 */
export function isEmptyHtml(html: string): boolean {
  if (!html) return true
  const stripped = stripTags(html).trim()
  return stripped === ''
}
