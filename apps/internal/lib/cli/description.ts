/**
 * Task descriptions are stored as TipTap HTML. Plain text survives a read —
 * the editor renders it as one paragraph — but every newline is collapsed, and
 * the first time someone opens and saves the task in the UI the editor rewrites
 * it to HTML, producing a spurious "updated description" activity entry.
 *
 * So convert on the way in. Callers send plain text (what a CLI flag or an
 * agent naturally produces) and we store what the editor would have stored.
 * Input that already looks like HTML passes through untouched.
 */

const HTML_BLOCK = /<(p|ul|ol|li|h[1-6]|blockquote|pre|div|br)\b/i
const BULLET = /^[-*]\s+(.*)$/

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function toRichTextHtml(input: string): string {
  if (!input.trim()) {
    return ''
  }

  if (HTML_BLOCK.test(input)) {
    return input
  }

  const out: string[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (!bullets.length) {
      return
    }

    const items = bullets
      .map(item => `<li><p>${escapeHtml(item)}</p></li>`)
      .join('')

    out.push(`<ul>${items}</ul>`)
    bullets = []
  }

  for (const rawLine of input.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim()

    if (!line) {
      flushBullets()
      continue
    }

    const bullet = line.match(BULLET)

    if (bullet) {
      bullets.push(bullet[1])
      continue
    }

    // A non-bullet line ends any run of bullets before it.
    flushBullets()
    out.push(`<p>${escapeHtml(line)}</p>`)
  }

  flushBullets()

  return out.join('')
}
