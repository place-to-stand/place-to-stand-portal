'use client'

import type { RichBlock, RichTextRun } from '@/lib/google/sow-parser-types'

// =============================================================================
// Text run renderer
// =============================================================================

function TextRunRenderer({ run }: { run: RichTextRun }) {
  let content: React.ReactNode = run.text

  if (run.bold) content = <strong>{content}</strong>
  if (run.italic) content = <em>{content}</em>
  if (run.underline) content = <u>{content}</u>
  if (run.strikethrough) content = <del>{content}</del>
  if (run.linkUrl) {
    content = (
      <a href={run.linkUrl} target='_blank' rel='noopener noreferrer'>
        {content}
      </a>
    )
  }

  return <>{content}</>
}

function RunsRenderer({ runs }: { runs: RichTextRun[] }) {
  return (
    <>
      {runs.map((run, i) => (
        <TextRunRenderer key={i} run={run} />
      ))}
    </>
  )
}

// =============================================================================
// Block renderers
// =============================================================================

function HeadingRenderer({
  level,
  runs,
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6
  runs: RichTextRun[]
}) {
  const Tag = `h${level}` as const
  return (
    <Tag>
      <RunsRenderer runs={runs} />
    </Tag>
  )
}

function ParagraphRenderer({ runs }: { runs: RichTextRun[] }) {
  // Skip empty paragraphs (just whitespace/newlines)
  const hasContent = runs.some(r => r.text.trim().length > 0)
  if (!hasContent) return null

  return (
    <p>
      <RunsRenderer runs={runs} />
    </p>
  )
}

function TableRenderer({
  rows,
}: {
  rows: Array<{ cells: Array<{ blocks: RichBlock[] }> }>
}) {
  return (
    <table>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.cells.map((cell, ci) => (
              <td key={ci}>
                <BlockList blocks={cell.blocks} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// =============================================================================
// List grouping — consecutive list-items grouped into <ul>/<ol>
// =============================================================================

type GroupedBlock =
  | { kind: 'single'; block: RichBlock }
  | {
      kind: 'list'
      ordered: boolean
      items: Array<
        Extract<RichBlock, { type: 'list-item' }>
      >
    }

function groupBlocks(blocks: RichBlock[]): GroupedBlock[] {
  const groups: GroupedBlock[] = []

  for (const block of blocks) {
    if (block.type === 'list-item') {
      const last = groups[groups.length - 1]
      if (last?.kind === 'list' && last.ordered === block.ordered) {
        last.items.push(block)
      } else {
        groups.push({
          kind: 'list',
          ordered: block.ordered,
          items: [block],
        })
      }
    } else {
      groups.push({ kind: 'single', block })
    }
  }

  return groups
}

function ListGroup({
  ordered,
  items,
}: {
  ordered: boolean
  items: Array<Extract<RichBlock, { type: 'list-item' }>>
}) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag>
      {items.map((item, i) => (
        <li key={i} style={{ marginLeft: `${item.nestingLevel * 1.5}rem` }}>
          <RunsRenderer runs={item.runs} />
        </li>
      ))}
    </Tag>
  )
}

// =============================================================================
// Block list (recursive for table cells)
// =============================================================================

function BlockList({ blocks }: { blocks: RichBlock[] }) {
  const groups = groupBlocks(blocks)

  return (
    <>
      {groups.map((group, i) => {
        if (group.kind === 'list') {
          return (
            <ListGroup
              key={i}
              ordered={group.ordered}
              items={group.items}
            />
          )
        }

        const block = group.block

        switch (block.type) {
          case 'heading':
            return (
              <HeadingRenderer
                key={i}
                level={block.level}
                runs={block.runs}
              />
            )
          case 'paragraph':
            return <ParagraphRenderer key={i} runs={block.runs} />
          case 'table':
            return <TableRenderer key={i} rows={block.rows} />
          case 'section-break':
            return <hr key={i} />
          default:
            return null
        }
      })}
    </>
  )
}

// =============================================================================
// Top-level renderer
// =============================================================================

type SowDocumentRendererProps = {
  blocks: RichBlock[]
}

export function SowDocumentRenderer({ blocks }: SowDocumentRendererProps) {
  return (
    <div className='prose prose-sm max-w-none text-black'>
      <BlockList blocks={blocks} />
    </div>
  )
}
