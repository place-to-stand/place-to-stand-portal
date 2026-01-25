/**
 * Shared document styling constants for proposal preview and Google Docs generation.
 * These values are designed to produce visual parity between the live preview
 * and the final Google Docs output.
 */

// =============================================================================
// Font Configuration
// =============================================================================

export const DOCUMENT_FONTS = {
  family: 'Arial, sans-serif',
  fallback: 'sans-serif',
} as const

// =============================================================================
// Typography Scale
// =============================================================================

export const DOCUMENT_TYPOGRAPHY = {
  // Logo styling
  logo: {
    main: {
      size: '28pt',
      weight: 700,
      lineHeight: 1.2,
    },
    subtitle: {
      size: '11pt',
      weight: 400,
      lineHeight: 1.4,
    },
  },

  // Section headers (ALL CAPS styling)
  sectionHeader: {
    size: '14pt',
    weight: 700,
    lineHeight: 1.4,
    textTransform: 'uppercase' as const,
  },

  // Phase titles
  phaseTitle: {
    size: '12pt',
    weight: 700,
    lineHeight: 1.4,
  },

  // Body text
  body: {
    size: '11pt',
    weight: 400,
    lineHeight: 1.5,
  },

  // Labels (bold inline text)
  label: {
    weight: 700,
  },

  // Client company in header
  clientCompanyHeader: {
    size: '20pt',
    weight: 700,
    lineHeight: 1.3,
  },

  // "Proposal for" text
  proposalForText: {
    size: '11pt',
    weight: 400,
    lineHeight: 1.4,
  },

  // Signature section headers
  signatureHeader: {
    size: '11pt',
    weight: 700,
    lineHeight: 1.4,
  },
} as const

// =============================================================================
// Spacing
// =============================================================================

export const DOCUMENT_SPACING = {
  // Section gaps
  sectionGap: '24pt',
  sectionGapPx: 32,

  // Paragraph gaps
  paragraphGap: '12pt',
  paragraphGapPx: 16,

  // Line spacing
  lineGap: '6pt',
  lineGapPx: 8,

  // List indentation
  listIndent: '24pt',
  listIndentPx: 32,

  // Deliverable bullet indent (4 spaces worth)
  deliverableIndent: '16pt',
  deliverableIndentPx: 16,
} as const

// =============================================================================
// Colors
// =============================================================================

export const DOCUMENT_COLORS = {
  // Primary text
  text: '#000000',

  // Links
  link: '#1a73e8',

  // Signature box background (light blue)
  signatureBox: '#e3f2fd',
  signatureBoxBorder: '#bbdefb',

  // Divider
  divider: '#000000',
} as const

// =============================================================================
// Document Dimensions
// =============================================================================

export const DOCUMENT_DIMENSIONS = {
  // Standard US Letter size
  width: '8.5in',
  widthPx: 816,

  // Margins (1 inch = 96px)
  margin: '1in',
  marginPx: 96,

  // Content width (8.5in - 2in margins)
  contentWidth: '6.5in',
  contentWidthPx: 624,

  // Preview scale factor (for fitting in panel)
  previewScale: 0.65,
} as const

// =============================================================================
// CSS Custom Properties (for use in preview components)
// =============================================================================

export const DOCUMENT_CSS_VARS = {
  '--doc-font-family': DOCUMENT_FONTS.family,
  '--doc-text-color': DOCUMENT_COLORS.text,
  '--doc-link-color': DOCUMENT_COLORS.link,
  '--doc-body-size': DOCUMENT_TYPOGRAPHY.body.size,
  '--doc-section-header-size': DOCUMENT_TYPOGRAPHY.sectionHeader.size,
  '--doc-phase-title-size': DOCUMENT_TYPOGRAPHY.phaseTitle.size,
  '--doc-logo-size': DOCUMENT_TYPOGRAPHY.logo.main.size,
  '--doc-section-gap': DOCUMENT_SPACING.sectionGap,
  '--doc-paragraph-gap': DOCUMENT_SPACING.paragraphGap,
} as const

// =============================================================================
// Static Content (dividers, separators)
// =============================================================================

export const DOCUMENT_ELEMENTS = {
  // Horizontal divider (60 em dashes)
  divider: '─'.repeat(60),
  dividerCharCount: 60,

  // Signature line (40 underscores)
  signatureLine: '_'.repeat(40),
  signatureLineCharCount: 40,
} as const
