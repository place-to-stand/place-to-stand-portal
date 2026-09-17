/**
 * Structured body blocks for messages that are more than a few paragraphs — a
 * form submission recap, say, with a key/value table and a quoted message.
 *
 * A template lists blocks once and `renderBlocks` produces both parts, so the
 * HTML and the plain text cannot drift. Every tag carries its own `style`,
 * which is also what makes the output safe to hand to `renderRichEmail`: its
 * tag rules only apply to tags without one.
 */
import { EMAIL_COLORS as C, EMAIL_FONTS as F, escapeHtml } from './layout'

export type EmailDetailRow = {
  label: string
  value: string
  /** Turns the value into a link (`mailto:` or `https:`). Ours, not user input. */
  href?: string
}

export type EmailListItem = {
  title: string
  detail?: string
}

export type EmailBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  /** Small mono section label, e.g. "Where they came from". */
  | { type: 'label'; text: string }
  | { type: 'rows'; rows: EmailDetailRow[] }
  /** Visitor-authored prose. Line breaks are preserved. */
  | { type: 'quote'; text: string }
  | { type: 'list'; items: EmailListItem[] }
  /** Question/answer pairs: muted prompt over a bold answer. */
  | { type: 'pairs'; items: Array<{ prompt: string; answer: string }> }
  /** Inline call-to-action, for when it belongs above the fold. */
  | { type: 'button'; label: string; url: string }
  | { type: 'divider' }

const LINK = `color:${C.ink};text-decoration:underline;`

function withBreaks(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br />')
}

function blockHtml(block: EmailBlock): string {
  switch (block.type) {
    case 'heading':
      return `<h1 style="margin:0 0 16px;font-family:${F.head};font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">${escapeHtml(block.text)}</h1>`

    case 'paragraph':
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.ink};">${escapeHtml(block.text)}</p>`

    case 'label':
      return `<p style="margin:0 0 10px;font-family:${F.mono};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${C.faint};">${escapeHtml(block.text)}</p>`

    case 'rows': {
      const rows = block.rows
        .map(row => {
          const value = row.href
            ? `<a href="${escapeHtml(row.href)}" style="${LINK}">${escapeHtml(row.value)}</a>`
            : escapeHtml(row.value)
          return `<tr>
            <td width="96" style="width:96px;padding:4px 12px 4px 0;vertical-align:top;font-family:${F.mono};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint};">${escapeHtml(row.label)}</td>
            <td style="padding:4px 0;vertical-align:top;font-size:14px;line-height:1.5;color:${C.ink};word-break:break-word;">${value}</td>
          </tr>`
        })
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">${rows}</table>`
    }

    case 'quote':
      return `<p style="margin:0 0 20px;padding:12px 16px;border-left:3px solid ${C.accentInk};background:${C.backdrop};font-size:15px;line-height:1.6;color:${C.ink};">${withBreaks(block.text)}</p>`

    case 'list': {
      const items = block.items
        .map((item, index) => {
          const detail = item.detail
            ? `<br /><span style="font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(item.detail)}</span>`
            : ''
          return `<tr>
            <td width="24" style="width:24px;padding:6px 0;vertical-align:top;font-family:${F.mono};font-size:12px;color:${C.faint};">${index + 1}.</td>
            <td style="padding:6px 0;vertical-align:top;font-size:15px;line-height:1.5;font-weight:600;color:${C.ink};">${escapeHtml(item.title)}${detail}</td>
          </tr>`
        })
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">${items}</table>`
    }

    case 'pairs': {
      const items = block.items
        .map(
          item =>
            `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(item.prompt)}<br /><span style="font-size:14px;font-weight:600;color:${C.ink};">${withBreaks(item.answer)}</span></p>`
        )
        .join('')
      return `<div style="margin:0 0 8px;">${items}</div>`
    }

    case 'button':
      return `<p style="margin:0 0 24px;">
         <a href="${escapeHtml(block.url)}" style="display:inline-block;padding:12px 24px;background:${C.ink};border:1px solid ${C.ink};color:${C.accent};text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${escapeHtml(block.label)}</a>
       </p>`

    case 'divider':
      return `<hr style="border:none;border-top:1px solid ${C.rule};margin:4px 0 24px;" />`
  }
}

function blockText(block: EmailBlock): string[] {
  switch (block.type) {
    case 'heading':
      return [block.text, '']
    case 'paragraph':
      return [block.text, '']
    case 'label':
      return [block.text.toUpperCase()]
    case 'rows':
      return [...block.rows.map(row => `${row.label}: ${row.value}`), '']
    case 'quote':
      return [...block.text.split(/\r?\n/).map(line => `> ${line}`), '']
    case 'list':
      return [
        ...block.items.flatMap((item, index) => [
          `${index + 1}. ${item.title}`,
          ...(item.detail ? [`   ${item.detail}`] : []),
        ]),
        '',
      ]
    case 'pairs':
      return [
        ...block.items.flatMap(item => [`- ${item.prompt}`, `  ${item.answer}`]),
        '',
      ]
    case 'button':
      return [`${block.label}: ${block.url}`, '']
    case 'divider':
      return []
  }
}

export function renderBlocks(blocks: EmailBlock[]): {
  html: string
  text: string
} {
  return {
    html: blocks.map(blockHtml).join('\n'),
    text: blocks.flatMap(blockText).join('\n').trimEnd(),
  }
}
