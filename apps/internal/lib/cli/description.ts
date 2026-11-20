/**
 * Task descriptions and comments are stored as TipTap HTML. Plain text survives
 * a read — the editor renders it as one paragraph — but every newline is
 * collapsed, and the first time someone opens and saves the task in the UI the
 * editor rewrites it to HTML, producing a spurious "updated description"
 * activity entry.
 *
 * So convert on the way in. Callers send plain text or minimal markdown (what a
 * CLI flag or an agent naturally produces) and we store what the editor would
 * have stored. Supported: paragraphs on blank lines, `- ` / `* ` bullets,
 * `1. ` numbered lists (indent an item under the one above to nest it), **bold**, *italic*, `code`, and [text](https://…)
 * links (code spans because a comment for the team often names a branch or a
 * command). Anything else is
 * escaped as text. Input that already looks like HTML passes through untouched.
 */

import { escapeHtml, inlineMarkdown } from '@/lib/cli/markdown'

const HTML_BLOCK = /<(p|ul|ol|li|h[1-6]|blockquote|pre|div|br)\b/i
const BULLET = /^[-*]\s+(.*)$/
const NUMBERED = /^\d+[.)]\s+(.*)$/
const CODE_SPAN = /`([^`\n]+)`/g

/**
 * Inline markdown for one line. Code spans are split out first so their
 * contents are never re-parsed for emphasis or links.
 */
function inline(text: string): string {
  const out: string[] = []
  let last = 0

  for (const match of text.matchAll(CODE_SPAN)) {
    out.push(inlineMarkdown(text.slice(last, match.index)))
    out.push(`<code>${escapeHtml(match[1])}</code>`)
    last = match.index + match[0].length
  }

  out.push(inlineMarkdown(text.slice(last)))

  return out.join('')
}

type ListKind = 'ul' | 'ol'

type ListItem = { html: string; children: List[] }
type List = { kind: ListKind; indent: number; items: ListItem[] }

/** Leading whitespace as columns, a tab counting as four. */
function indentOf(line: string): number {
  let columns = 0
  for (const char of line) {
    if (char === ' ') columns += 1
    else if (char === '\t') columns += 4
    else break
  }
  return columns
}

function renderList(list: List): string {
  const items = list.items.map(
    item =>
      `<li><p>${item.html}</p>${item.children.map(renderList).join('')}</li>`
  )
  return `<${list.kind}>${items.join('')}</${list.kind}>`
}

export function toRichTextHtml(input: string): string {
  if (!input.trim()) {
    return ''
  }

  if (HTML_BLOCK.test(input)) {
    return input
  }

  const out: string[] = []
  // The open lists, outermost first. An item indented past the item above
  // it opens a list inside that item, the way Markdown nests.
  let stack: List[] = []

  const flushList = () => {
    if (stack.length > 0) {
      out.push(renderList(stack[0]))
    }
    stack = []
  }

  const pushItem = (kind: ListKind, indent: number, text: string) => {
    // Close lists indented deeper than this item.
    while (stack.length > 1 && indent < stack[stack.length - 1].indent) {
      stack.pop()
    }

    const current = stack.at(-1)
    const item: ListItem = { html: inline(text), children: [] }

    if (!current) {
      stack = [{ kind, indent, items: [item] }]
      return
    }

    if (indent > current.indent) {
      // Nest under the last item of the current list.
      const nested: List = { kind, indent, items: [item] }
      current.items.at(-1)?.children.push(nested)
      stack.push(nested)
      return
    }

    if (current.kind === kind) {
      current.items.push(item)
      return
    }

    // Same level, other kind: a new list beside the old one.
    const sibling: List = { kind, indent: current.indent, items: [item] }
    if (stack.length === 1) {
      flushList()
      stack = [sibling]
      return
    }
    stack.pop()
    stack.at(-1)?.items.at(-1)?.children.push(sibling)
    stack.push(sibling)
  }

  for (const rawLine of input.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim()

    if (!line) {
      flushList()
      continue
    }

    const indent = indentOf(rawLine)

    const bullet = line.match(BULLET)
    if (bullet) {
      pushItem('ul', indent, bullet[1])
      continue
    }

    const numbered = line.match(NUMBERED)
    if (numbered) {
      pushItem('ol', indent, numbered[1])
      continue
    }

    // A non-list line ends any run of list items before it.
    flushList()
    out.push(`<p>${inline(line)}</p>`)
  }

  flushList()

  return out.join('')
}
