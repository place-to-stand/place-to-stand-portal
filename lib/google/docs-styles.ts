import type { ParagraphStyle, TextStyle, TableCellStyle } from './docs-builder'

// =============================================================================
// Font and Size Configuration
// =============================================================================

export const DOC_FONTS = {
  heading: 'Arial',
  body: 'Arial',
} as const

export const DOC_SIZES = {
  title: 24,
  heading1: 18,
  heading2: 14,
  heading3: 12,
  body: 11,
  small: 10,
} as const

// =============================================================================
// Spacing Configuration
// =============================================================================

export const DOC_SPACING = {
  sectionGap: 18, // Space between major sections (PT)
  paragraphGap: 6, // Space between paragraphs (PT)
  listItemGap: 3, // Space between list items (PT)
  tableRowGap: 6, // Internal table cell padding (PT)
} as const

// =============================================================================
// Color Configuration
// =============================================================================

export const DOC_COLORS = {
  text: { red: 0, green: 0, blue: 0 },
  link: { red: 0.06, green: 0.46, blue: 0.88 }, // Standard link blue
  muted: { red: 0.4, green: 0.4, blue: 0.4 },
  signatureBoxBg: { red: 0.95, green: 0.97, blue: 1 }, // Light blue-gray
} as const

// =============================================================================
// Pre-built Paragraph Styles
// =============================================================================

export const PARAGRAPH_STYLES = {
  title: {
    namedStyleType: 'TITLE',
    spaceBelow: { magnitude: DOC_SPACING.sectionGap, unit: 'PT' },
  } as ParagraphStyle,

  heading1: {
    namedStyleType: 'HEADING_1',
    spaceAbove: { magnitude: DOC_SPACING.sectionGap, unit: 'PT' },
    spaceBelow: { magnitude: DOC_SPACING.paragraphGap, unit: 'PT' },
  } as ParagraphStyle,

  heading2: {
    namedStyleType: 'HEADING_2',
    spaceAbove: { magnitude: DOC_SPACING.paragraphGap * 2, unit: 'PT' },
    spaceBelow: { magnitude: DOC_SPACING.paragraphGap, unit: 'PT' },
  } as ParagraphStyle,

  heading3: {
    namedStyleType: 'HEADING_3',
    spaceAbove: { magnitude: DOC_SPACING.paragraphGap, unit: 'PT' },
    spaceBelow: { magnitude: DOC_SPACING.listItemGap, unit: 'PT' },
  } as ParagraphStyle,

  normal: {
    namedStyleType: 'NORMAL_TEXT',
    spaceBelow: { magnitude: DOC_SPACING.paragraphGap, unit: 'PT' },
  } as ParagraphStyle,

  listItem: {
    namedStyleType: 'NORMAL_TEXT',
    spaceBelow: { magnitude: DOC_SPACING.listItemGap, unit: 'PT' },
  } as ParagraphStyle,

  centered: {
    namedStyleType: 'NORMAL_TEXT',
    alignment: 'CENTER',
    spaceBelow: { magnitude: DOC_SPACING.paragraphGap, unit: 'PT' },
  } as ParagraphStyle,

  sectionHeader: {
    namedStyleType: 'HEADING_1',
    spaceAbove: { magnitude: DOC_SPACING.sectionGap * 1.5, unit: 'PT' },
    spaceBelow: { magnitude: DOC_SPACING.paragraphGap, unit: 'PT' },
  } as ParagraphStyle,
} as const

// =============================================================================
// Pre-built Text Styles
// =============================================================================

export const TEXT_STYLES = {
  bold: {
    bold: true,
  } as TextStyle,

  italic: {
    italic: true,
  } as TextStyle,

  boldItalic: {
    bold: true,
    italic: true,
  } as TextStyle,

  heading1: {
    bold: true,
    fontSize: { magnitude: DOC_SIZES.heading1, unit: 'PT' },
    weightedFontFamily: { fontFamily: DOC_FONTS.heading },
  } as TextStyle,

  heading2: {
    bold: true,
    fontSize: { magnitude: DOC_SIZES.heading2, unit: 'PT' },
    weightedFontFamily: { fontFamily: DOC_FONTS.heading },
  } as TextStyle,

  heading3: {
    bold: true,
    fontSize: { magnitude: DOC_SIZES.heading3, unit: 'PT' },
    weightedFontFamily: { fontFamily: DOC_FONTS.heading },
  } as TextStyle,

  body: {
    fontSize: { magnitude: DOC_SIZES.body, unit: 'PT' },
    weightedFontFamily: { fontFamily: DOC_FONTS.body },
  } as TextStyle,

  small: {
    fontSize: { magnitude: DOC_SIZES.small, unit: 'PT' },
    weightedFontFamily: { fontFamily: DOC_FONTS.body },
  } as TextStyle,

  link: {
    foregroundColor: { color: { rgbColor: DOC_COLORS.link } },
    underline: true,
  } as TextStyle,

  muted: {
    foregroundColor: { color: { rgbColor: DOC_COLORS.muted } },
  } as TextStyle,

  title: {
    bold: true,
    fontSize: { magnitude: DOC_SIZES.title, unit: 'PT' },
    weightedFontFamily: { fontFamily: DOC_FONTS.heading },
  } as TextStyle,
} as const

// =============================================================================
// Pre-built Table Cell Styles
// =============================================================================

export const TABLE_CELL_STYLES = {
  default: {
    paddingTop: { magnitude: DOC_SPACING.tableRowGap, unit: 'PT' },
    paddingBottom: { magnitude: DOC_SPACING.tableRowGap, unit: 'PT' },
    paddingLeft: { magnitude: DOC_SPACING.tableRowGap, unit: 'PT' },
    paddingRight: { magnitude: DOC_SPACING.tableRowGap, unit: 'PT' },
  } as TableCellStyle,

  signatureBox: {
    backgroundColor: { color: { rgbColor: DOC_COLORS.signatureBoxBg } },
    paddingTop: { magnitude: 12, unit: 'PT' },
    paddingBottom: { magnitude: 12, unit: 'PT' },
    paddingLeft: { magnitude: 12, unit: 'PT' },
    paddingRight: { magnitude: 12, unit: 'PT' },
  } as TableCellStyle,

  noPadding: {
    paddingTop: { magnitude: 0, unit: 'PT' },
    paddingBottom: { magnitude: 0, unit: 'PT' },
    paddingLeft: { magnitude: 0, unit: 'PT' },
    paddingRight: { magnitude: 0, unit: 'PT' },
  } as TableCellStyle,
} as const

// =============================================================================
// Bullet Presets
// =============================================================================

export const BULLET_PRESETS = {
  disc: 'BULLET_DISC_CIRCLE_SQUARE',
  numbered: 'NUMBERED_DECIMAL_ALPHA_ROMAN',
  checkbox: 'BULLET_CHECKBOX',
} as const
