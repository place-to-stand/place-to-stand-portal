import type { EmailBlock } from '../blocks'

/**
 * The scored audit, as the marketing site stores it. Self-describing on
 * purpose (names, not ids), so rendering it needs none of the site's scoring
 * code.
 */
export type AuditEmailResult = {
  phaseName: string
  /** Null for audits stored before the site started sending it. */
  phaseTagline: string | null
  summary: string
  recommendations: Array<{
    serviceName: string
    tagline: string | null
    reasons: string[]
  }>
}

export function resultBlocks(
  result: AuditEmailResult,
  { includeReasons }: { includeReasons: boolean }
): EmailBlock[] {
  const blocks: EmailBlock[] = [
    { type: 'label', text: 'Business phase' },
    { type: 'heading', text: result.phaseName },
    ...(result.phaseTagline
      ? ([
          { type: 'paragraph', text: result.phaseTagline },
        ] satisfies EmailBlock[])
      : []),
    { type: 'paragraph', text: result.summary },
  ]

  if (result.recommendations.length > 0) {
    blocks.push(
      { type: 'label', text: 'Where to start' },
      {
        type: 'list',
        items: result.recommendations.map(rec => ({
          title: rec.serviceName,
          detail: rec.tagline ?? undefined,
          note:
            includeReasons && rec.reasons.length > 0
              ? `Signals: ${rec.reasons.join(', ')}`
              : undefined,
        })),
      }
    )
  }

  return blocks
}
