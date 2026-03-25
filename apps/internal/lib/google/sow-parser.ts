import 'server-only'

import { createHash } from 'crypto'

// Re-export all types so existing imports keep working
export type {
  TextStyle,
  TextRun,
  ParagraphElement,
  ParagraphStyle,
  ParagraphBullet,
  Paragraph,
  Table,
  StructuralElement,
  GoogleDocsBody,
  GoogleDocsDocument,
  ParsedSection,
  RichTextRun,
  RichBlock,
} from './sow-parser-types'

import type {
  Paragraph,
  StructuralElement,
  GoogleDocsDocument,
  ParsedSection,
  RichTextRun,
  RichBlock,
  TextStyle,
} from './sow-parser-types'

// =============================================================================
// Heading level mapping
// =============================================================================

const HEADING_LEVEL_MAP: Record<string, number> = {
  HEADING_1: 1,
  HEADING_2: 2,
  HEADING_3: 3,
  HEADING_4: 4,
  HEADING_5: 5,
  HEADING_6: 6,
}

// Ordered glyph types in Google Docs API
const ORDERED_GLYPH_TYPES = new Set([
  'DECIMAL',
  'ALPHA',
  'UPPER_ALPHA',
  'ROMAN',
  'UPPER_ROMAN',
])

// =============================================================================
// Text extraction (plain text)
// =============================================================================

function extractParagraphText(paragraph: Paragraph): string {
  if (!paragraph.elements) return ''
  return paragraph.elements
    .map(el => el.textRun?.content ?? '')
    .join('')
}

function extractElementsText(elements: StructuralElement[]): string {
  const parts: string[] = []

  for (const el of elements) {
    if (el.paragraph) {
      parts.push(extractParagraphText(el.paragraph))
    } else if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        for (const cell of row.tableCells ?? []) {
          if (cell.content) {
            parts.push(extractElementsText(cell.content))
          }
        }
      }
    }
  }

  return parts.join('')
}

// =============================================================================
// Plaintext extraction (full document)
// =============================================================================

export function extractPlaintext(doc: GoogleDocsDocument): string {
  if (!doc.body?.content) return ''
  return extractElementsText(doc.body.content).trim()
}

// =============================================================================
// Section parsing
// =============================================================================

function computeContentHash(heading: string, body: string): string {
  return createHash('sha256')
    .update(`${heading}\n${body}`)
    .digest('hex')
}

export function parseSections(doc: GoogleDocsDocument): ParsedSection[] {
  const elements = doc.body?.content
  if (!elements) return []

  const sections: ParsedSection[] = []
  let currentHeading: { level: number; text: string } | null = null
  let currentBodyParts: string[] = []
  let sectionOrder = 0

  function flushSection() {
    if (!currentHeading) return

    const bodyText = currentBodyParts.join('').trim()
    sectionOrder++

    sections.push({
      headingLevel: currentHeading.level,
      headingText: currentHeading.text.trim(),
      bodyText,
      sectionOrder,
      contentHash: computeContentHash(currentHeading.text.trim(), bodyText),
    })
  }

  for (const el of elements) {
    if (!el.paragraph) {
      // Tables and other elements go into the current section body
      if (el.table && currentHeading) {
        currentBodyParts.push(extractElementsText([el]))
      }
      continue
    }

    const style = el.paragraph.paragraphStyle?.namedStyleType
    const headingLevel = style ? HEADING_LEVEL_MAP[style] : undefined

    if (headingLevel) {
      // Flush previous section
      flushSection()

      currentHeading = {
        level: headingLevel,
        text: extractParagraphText(el.paragraph),
      }
      currentBodyParts = []
    } else if (currentHeading) {
      // Content under a heading
      currentBodyParts.push(extractParagraphText(el.paragraph))
    }
    // Content before the first heading is ignored (title page, etc.)
  }

  // Flush the last section
  flushSection()

  return sections
}

// =============================================================================
// Rich content parsing (for React rendering)
// =============================================================================

function extractRuns(paragraph: Paragraph): RichTextRun[] {
  if (!paragraph.elements) return []

  const runs: RichTextRun[] = []

  for (const el of paragraph.elements) {
    const text = el.textRun?.content
    if (!text) continue

    const style = el.textRun?.textStyle as TextStyle | undefined

    runs.push({
      text,
      bold: style?.bold || undefined,
      italic: style?.italic || undefined,
      underline: style?.underline || undefined,
      strikethrough: style?.strikethrough || undefined,
      linkUrl: style?.link?.url || undefined,
    })
  }

  return runs
}

function parseElements(
  elements: StructuralElement[],
  doc: GoogleDocsDocument,
  depth: number = 0
): RichBlock[] {
  if (depth > 5) return []

  const blocks: RichBlock[] = []

  for (const el of elements) {
    if (el.sectionBreak) {
      blocks.push({ type: 'section-break' })
      continue
    }

    if (el.paragraph) {
      const runs = extractRuns(el.paragraph)

      // Detect heading
      const style = el.paragraph.paragraphStyle?.namedStyleType
      const headingLevel = style ? HEADING_LEVEL_MAP[style] : undefined

      if (headingLevel && headingLevel >= 1 && headingLevel <= 6) {
        blocks.push({
          type: 'heading',
          level: headingLevel as 1 | 2 | 3 | 4 | 5 | 6,
          runs,
        })
        continue
      }

      // Detect list item
      if (el.paragraph.bullet) {
        const { listId, nestingLevel } = el.paragraph.bullet
        let ordered = false

        if (doc.lists?.[listId]) {
          const nestingLevels =
            doc.lists[listId].listProperties.nestingLevels
          const glyphType = nestingLevels?.[nestingLevel]?.glyphType
          if (glyphType && ORDERED_GLYPH_TYPES.has(glyphType)) {
            ordered = true
          }
        }

        blocks.push({
          type: 'list-item',
          ordered,
          nestingLevel,
          runs,
        })
        continue
      }

      // Regular paragraph
      blocks.push({ type: 'paragraph', runs })
      continue
    }

    if (el.table?.tableRows) {
      const rows = el.table.tableRows.map(row => ({
        cells: (row.tableCells ?? []).map(cell => ({
          blocks: cell.content
            ? parseElements(cell.content, doc, depth + 1)
            : [],
        })),
      }))

      blocks.push({ type: 'table', rows })
    }
  }

  return blocks
}

export function parseRichContent(doc: GoogleDocsDocument): RichBlock[] {
  if (!doc.body?.content) return []
  return parseElements(doc.body.content, doc)
}

// =============================================================================
// Formatted text extraction (for AI consumption)
// =============================================================================

function formatRunText(run: RichTextRun): string {
  let text = run.text

  // Don't wrap whitespace-only runs
  if (!text.trim()) return text

  if (run.strikethrough) text = `~~${text.trim()}~~`
  if (run.bold) text = `**${text.trim()}**`
  if (run.italic) text = `*${text.trim()}*`
  if (run.linkUrl) text = `[${text.trim()}](${run.linkUrl})`

  return text
}

function formatRuns(runs: RichTextRun[]): string {
  return runs.map(formatRunText).join('')
}

function formatBlocksToText(blocks: RichBlock[], indent: string = ''): string {
  const lines: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const hashes = '#'.repeat(block.level)
        lines.push(`${hashes} ${formatRuns(block.runs).trim()}`)
        lines.push('')
        break
      }

      case 'paragraph': {
        const text = formatRuns(block.runs).trim()
        if (text) {
          lines.push(`${indent}${text}`)
          lines.push('')
        }
        break
      }

      case 'list-item': {
        const prefix = block.ordered ? '1. ' : '- '
        const nestIndent = '  '.repeat(block.nestingLevel)
        lines.push(
          `${indent}${nestIndent}${prefix}${formatRuns(block.runs).trim()}`
        )
        break
      }

      case 'table': {
        for (const row of block.rows) {
          const cellTexts = row.cells.map(cell =>
            formatBlocksToText(cell.blocks)
              .trim()
              .replace(/\n/g, ' ')
          )
          lines.push(`| ${cellTexts.join(' | ')} |`)
        }
        lines.push('')
        break
      }

      case 'section-break':
        lines.push('---')
        lines.push('')
        break
    }
  }

  return lines.join('\n')
}

export function extractFormattedText(doc: GoogleDocsDocument): string {
  const blocks = parseRichContent(doc)
  return formatBlocksToText(blocks).trim()
}
