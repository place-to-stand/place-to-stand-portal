/**
 * Shared document styling constants for proposal preview and Google Docs generation.
 * These values are designed to produce visual parity between the live preview
 * and the final Google Docs output.
 */

// =============================================================================
// Document Settings Type (user-configurable)
// =============================================================================

export type TextAlignment = 'left' | 'center' | 'right' | 'justified'

export type DocumentSettings = {
  fontFamily: 'Arial' | 'Times New Roman' | 'Georgia' | 'Garamond' | 'Calibri'
  bodyFontSize: 10 | 11 | 12
  lineSpacing: 1.0 | 1.15 | 1.5 | 2.0
  sectionSpacing: 'compact' | 'normal' | 'relaxed'
  headerAlignment: TextAlignment
  bodyAlignment: TextAlignment
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  fontFamily: 'Arial',
  bodyFontSize: 11,
  lineSpacing: 1.5,
  sectionSpacing: 'normal',
  headerAlignment: 'left',
  bodyAlignment: 'left',
}

export const TEXT_ALIGNMENT_OPTIONS: Array<{ value: TextAlignment; label: string; icon: string }> = [
  { value: 'left', label: 'Left', icon: 'AlignLeft' },
  { value: 'center', label: 'Center', icon: 'AlignCenter' },
  { value: 'right', label: 'Right', icon: 'AlignRight' },
  { value: 'justified', label: 'Justified', icon: 'AlignJustify' },
]

export const FONT_FAMILY_OPTIONS: Array<{ value: DocumentSettings['fontFamily']; label: string; css: string }> = [
  { value: 'Arial', label: 'Arial', css: 'Arial, sans-serif' },
  { value: 'Times New Roman', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { value: 'Georgia', label: 'Georgia', css: 'Georgia, serif' },
  { value: 'Garamond', label: 'Garamond', css: 'Garamond, serif' },
  { value: 'Calibri', label: 'Calibri', css: 'Calibri, sans-serif' },
]

export const SECTION_SPACING_OPTIONS: Record<DocumentSettings['sectionSpacing'], { gap: number; paragraphGap: number }> = {
  compact: { gap: 24, paragraphGap: 12 },
  normal: { gap: 32, paragraphGap: 16 },
  relaxed: { gap: 40, paragraphGap: 20 },
}

/**
 * Generate dynamic styles based on document settings
 */
export function getDocumentStyles(settings: DocumentSettings) {
  const fontOption = FONT_FAMILY_OPTIONS.find(f => f.value === settings.fontFamily) ?? FONT_FAMILY_OPTIONS[0]
  const spacingOption = SECTION_SPACING_OPTIONS[settings.sectionSpacing]

  return {
    fontFamily: fontOption.css,
    bodySize: `${settings.bodyFontSize}pt`,
    lineHeight: settings.lineSpacing,
    sectionGap: spacingOption.gap,
    paragraphGap: spacingOption.paragraphGap,
    // Scaled sizes based on body font
    headerSize: `${settings.bodyFontSize + 3}pt`,
    phaseSize: `${settings.bodyFontSize + 1}pt`,
    logoSize: `${settings.bodyFontSize + 17}pt`,
    clientHeaderSize: `${settings.bodyFontSize + 9}pt`,
  }
}

// =============================================================================
// Font Configuration (defaults)
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
