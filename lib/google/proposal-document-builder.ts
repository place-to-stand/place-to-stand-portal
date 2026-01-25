import 'server-only'

import { format } from 'date-fns'

import type { ProposalContent } from '@/lib/proposals/types'
import {
  VENDOR_INFO,
  SCOPE_OF_WORK_INTRO,
  RISKS_INTRO,
  NEXT_STEPS_TEXT,
  FULL_TERMS_AND_CONDITIONS,
} from '@/lib/proposals/constants'

import {
  createBlankDocument,
  batchUpdateDocument,
  type DocumentRequest,
  type TextStyle,
} from './docs-builder'

// =============================================================================
// Style Constants
// =============================================================================

const STYLES = {
  // Logo text
  logoMain: {
    bold: true,
    fontSize: { magnitude: 28, unit: 'PT' as const },
    weightedFontFamily: { fontFamily: 'Arial' },
  },
  logoSubtitle: {
    bold: false,
    fontSize: { magnitude: 11, unit: 'PT' as const },
    weightedFontFamily: { fontFamily: 'Arial' },
  },
  // Section headers (ALL CAPS)
  sectionHeader: {
    bold: true,
    fontSize: { magnitude: 14, unit: 'PT' as const },
    weightedFontFamily: { fontFamily: 'Arial' },
  },
  // Phase titles
  phaseTitle: {
    bold: true,
    fontSize: { magnitude: 12, unit: 'PT' as const },
    weightedFontFamily: { fontFamily: 'Arial' },
  },
  // Labels (bold inline text)
  label: {
    bold: true,
  },
  // Client company in header
  clientCompanyHeader: {
    bold: true,
    fontSize: { magnitude: 20, unit: 'PT' as const },
    weightedFontFamily: { fontFamily: 'Arial' },
  },
  // "Proposal for" text
  proposalForText: {
    fontSize: { magnitude: 11, unit: 'PT' as const },
    weightedFontFamily: { fontFamily: 'Arial' },
  },
  // Signature section headers
  signatureHeader: {
    bold: true,
    fontSize: { magnitude: 11, unit: 'PT' as const },
    weightedFontFamily: { fontFamily: 'Arial' },
  },
} as const

// =============================================================================
// Main Builder Function
// =============================================================================

/**
 * Build a complete proposal document from structured content.
 * Returns the document ID and URL.
 */
export async function buildProposalDocument(
  userId: string,
  content: ProposalContent,
  title: string,
  options?: { connectionId?: string }
): Promise<{ docId: string; docUrl: string }> {
  // Create blank document
  const { docId, docUrl } = await createBlankDocument(userId, title, options)

  // Build all content and styling requests
  const requests = buildDocumentRequests(content)

  // Apply all requests in a single batch
  await batchUpdateDocument(userId, docId, requests, options)

  return { docId, docUrl }
}

// =============================================================================
// Document Structure Builder
// =============================================================================

interface StyleRange {
  start: number
  end: number
  style: TextStyle
}

/**
 * Build all requests for the proposal document.
 * Two-pass approach: insert all text first, then apply styling.
 */
function buildDocumentRequests(content: ProposalContent): DocumentRequest[] {
  const textParts: string[] = []
  const styleRanges: StyleRange[] = []
  let pos = 1 // Google Docs starts at index 1

  // Helper to add text and optionally track style
  const addText = (text: string, style?: TextStyle) => {
    const start = pos
    textParts.push(text)
    pos += text.length
    if (style) {
      styleRanges.push({ start, end: pos, style })
    }
    return { start, end: pos }
  }

  // Helper to add styled text within a line
  const addStyledSpan = (text: string, style: TextStyle) => {
    const start = pos
    pos += text.length
    styleRanges.push({ start, end: pos, style })
  }

  // ==========================================================================
  // 1. COVER SECTION - Logo & Title
  // ==========================================================================

  // Logo: "PLACE TO STAND"
  addText('PLACE TO STAND\n', STYLES.logoMain)

  // Logo subtitle: "AGENCY"
  addText('AGENCY\n', STYLES.logoSubtitle)

  // Horizontal divider
  addText('\n' + '─'.repeat(60) + '\n\n')

  // "Proposal for" label
  addText('Proposal for\n', STYLES.proposalForText)

  // Client company name (large)
  addText(`${content.client.companyName}\n\n`, STYLES.clientCompanyHeader)

  // ==========================================================================
  // 2. CLIENT / VENDOR INFO SECTION
  // ==========================================================================

  // Client info header
  addText('CLIENT\n', STYLES.signatureHeader)
  addText(`${content.client.companyName}\n`)
  addText(`${content.client.contactName}\n`)
  addText(`${content.client.contactEmail}\n`)
  if (content.client.contact2Name) {
    addText(`${content.client.contact2Name}\n`)
  }
  if (content.client.contact2Email) {
    addText(`${content.client.contact2Email}\n`)
  }
  addText('\n')

  // Vendor info header
  addText('VENDOR\n', STYLES.signatureHeader)
  addText(`${VENDOR_INFO.website}\n`)
  addText(`${VENDOR_INFO.name}\n`)
  addText(`${VENDOR_INFO.address.street}\n`)
  addText(`${VENDOR_INFO.address.city}, ${VENDOR_INFO.address.state} ${VENDOR_INFO.address.zip}\n`)
  addText(`${VENDOR_INFO.email}\n`)
  addText(`${VENDOR_INFO.phone}\n\n`)

  // ==========================================================================
  // 3. PROJECT OVERVIEW
  // ==========================================================================

  addText('PROJECT OVERVIEW\n', STYLES.sectionHeader)
  addText(`${content.projectOverviewText}\n\n`)

  // ==========================================================================
  // 4. SCOPE OF WORK
  // ==========================================================================

  addText('SCOPE OF WORK\n', STYLES.sectionHeader)
  addText(`${SCOPE_OF_WORK_INTRO}\n\n`)

  // Phases
  for (const phase of content.phases) {
    // Phase title
    addText(`Phase ${phase.index}: ${phase.title}\n`, STYLES.phaseTitle)

    // Purpose with bold label
    textParts.push('Purpose: ')
    addStyledSpan('Purpose: ', STYLES.label)
    addText(`${phase.purpose}\n`)

    // Deliverables with bold label
    textParts.push('Deliverables:\n')
    addStyledSpan('Deliverables:', STYLES.label)
    pos += 1 // for the newline

    for (const deliverable of phase.deliverables) {
      addText(`    • ${deliverable}\n`)
    }
    addText('\n')
  }

  // ==========================================================================
  // 5. POTENTIAL RISKS
  // ==========================================================================

  addText('POTENTIAL RISKS\n', STYLES.sectionHeader)
  addText(`${RISKS_INTRO}\n\n`)

  for (const risk of content.risks) {
    // Risk title (bold) followed by description
    const riskLine = `• ${risk.title}: ${risk.description}\n`
    textParts.push(riskLine)
    // Style just the title part as bold
    const titleStart = pos + 2 // after "• "
    const titleEnd = titleStart + risk.title.length
    styleRanges.push({ start: titleStart, end: titleEnd, style: STYLES.label })
    pos += riskLine.length
  }
  addText('\n')

  // ==========================================================================
  // 6. RATES & INITIAL ENGAGEMENT
  // ==========================================================================

  addText('RATES & INITIAL ENGAGEMENT\n', STYLES.sectionHeader)

  // Rate
  textParts.push('Rate: ')
  addStyledSpan('Rate: ', STYLES.label)
  addText(`$${content.rates.hourlyRate} per hour\n`)

  // Initial Commitment
  textParts.push('Initial Commitment: ')
  addStyledSpan('Initial Commitment: ', STYLES.label)
  addText(`${content.rates.initialCommitmentDescription}\n`)

  // Estimated Scoping
  textParts.push('Estimated Scoping/First Deliverable: ')
  addStyledSpan('Estimated Scoping/First Deliverable: ', STYLES.label)
  addText(`${content.rates.estimatedScopingHours}\n\n`)

  // ==========================================================================
  // 7. START DATE
  // ==========================================================================

  addText('START DATE\n', STYLES.sectionHeader)
  const validUntil = format(new Date(content.proposalValidUntil), 'MMMM d, yyyy')
  addText(`This proposal is valid until ${validUntil}. If this proposal is accepted and signed before expiration, the partnership can be kicked off within ${content.kickoffDays} business days.\n\n`)

  // ==========================================================================
  // 8. NEXT STEPS
  // ==========================================================================

  addText('NEXT STEPS\n', STYLES.sectionHeader)
  addText(`${NEXT_STEPS_TEXT}\n\n`)

  // ==========================================================================
  // 9. TERMS AND CONDITIONS
  // ==========================================================================

  addText('TERMS AND CONDITIONS\n', STYLES.sectionHeader)

  if (content.includeFullTerms) {
    // Include full terms and conditions
    for (const section of FULL_TERMS_AND_CONDITIONS) {
      // Section title (bold)
      textParts.push(`${section.title}\n`)
      addStyledSpan(`${section.title}\n`, STYLES.label)
      // Section content
      addText(`${section.content}\n\n`)
    }
  } else {
    addText('Standard terms and conditions apply. Full terms available upon request.\n\n')
  }

  // ==========================================================================
  // 10. SIGNATURES
  // ==========================================================================

  addText('SIGNATURES\n\n', STYLES.sectionHeader)

  // Client signature block
  addText('CLIENT\n', STYLES.signatureHeader)
  addText('\n\n')
  addText('_'.repeat(40) + '\n')
  const clientSig = content.client.signatoryName || content.client.contactName
  addText(`${clientSig}\n`)
  addText('Date: _________________\n\n\n')

  // Agency signature block
  addText('AGENCY\n', STYLES.signatureHeader)
  addText('\n\n')
  addText('_'.repeat(40) + '\n')
  addText(`${VENDOR_INFO.name}\n`)
  addText('Date: _________________\n')

  // ==========================================================================
  // BUILD REQUESTS
  // ==========================================================================

  const requests: DocumentRequest[] = []

  // 1. Insert all text as one block
  const fullText = textParts.join('')
  requests.push({
    insertText: {
      location: { index: 1 },
      text: fullText,
    },
  })

  // 2. Apply all styling
  for (const range of styleRanges) {
    const fields = buildFieldsString(range.style)
    requests.push({
      updateTextStyle: {
        range: { startIndex: range.start, endIndex: range.end },
        textStyle: range.style,
        fields,
      },
    })
  }

  return requests
}

/**
 * Build the fields string for updateTextStyle based on which properties are set.
 */
function buildFieldsString(style: TextStyle): string {
  const fields: string[] = []
  if (style.bold !== undefined) fields.push('bold')
  if (style.italic !== undefined) fields.push('italic')
  if (style.underline !== undefined) fields.push('underline')
  if (style.fontSize !== undefined) fields.push('fontSize')
  if (style.foregroundColor !== undefined) fields.push('foregroundColor')
  if (style.weightedFontFamily !== undefined) fields.push('weightedFontFamily')
  if (style.link !== undefined) fields.push('link')
  return fields.join(',')
}
