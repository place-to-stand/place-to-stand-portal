import type { EmailBlock } from '../blocks'

/**
 * The scored audit, as the marketing site stores it. Self-describing on
 * purpose (names, not ids), so rendering it needs none of the site's scoring
 * code.
 */
export type AuditEmailResult = {
  phaseName: string
  summary: string
  recommendations: Array<{ serviceName: string; reasons: string[] }>
}

export function resultBlocks(
  result: AuditEmailResult,
  { includeReasons }: { includeReasons: boolean }
): EmailBlock[] {
  const blocks: EmailBlock[] = [
    { type: 'label', text: 'Business phase' },
    { type: 'heading', text: result.phaseName },
    { type: 'paragraph', text: result.summary },
  ]

  if (result.recommendations.length > 0) {
    blocks.push(
      { type: 'label', text: 'Where to start' },
      {
        type: 'list',
        items: result.recommendations.map(rec => ({
          title: rec.serviceName,
          detail:
            includeReasons && rec.reasons.length > 0
              ? `Signals: ${rec.reasons.join(', ')}`
              : undefined,
        })),
      }
    )
  }

  return blocks
}
