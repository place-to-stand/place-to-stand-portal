// =============================================================================
// Types for Google Docs API response — shared between server and client
// =============================================================================

export type TextStyle = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  link?: { url: string }
  fontSize?: { magnitude: number; unit: string }
  foregroundColor?: {
    color?: { rgbColor?: { red?: number; green?: number; blue?: number } }
  }
  weightedFontFamily?: { fontFamily: string }
}

export type TextRun = {
  content?: string
  textStyle?: TextStyle
}

export type ParagraphElement = {
  startIndex?: number
  endIndex?: number
  textRun?: TextRun
  inlineObjectElement?: Record<string, unknown>
}

export type ParagraphStyle = {
  namedStyleType?: string
  headingId?: string
}

export type ParagraphBullet = {
  listId: string
  nestingLevel: number
}

export type Paragraph = {
  elements?: ParagraphElement[]
  paragraphStyle?: ParagraphStyle
  bullet?: ParagraphBullet
}

export type Table = {
  rows?: number
  columns?: number
  tableRows?: Array<{
    tableCells?: Array<{
      content?: StructuralElement[]
    }>
  }>
}

export type StructuralElement = {
  startIndex?: number
  endIndex?: number
  paragraph?: Paragraph
  table?: Table
  sectionBreak?: Record<string, unknown>
}

export type GoogleDocsBody = {
  content?: StructuralElement[]
}

export type GoogleDocsDocument = {
  documentId: string
  title: string
  body?: GoogleDocsBody
  revisionId?: string
  lists?: Record<
    string,
    {
      listProperties: {
        nestingLevels?: Array<{ glyphType?: string }>
      }
    }
  >
}

// =============================================================================
// Parsed section output
// =============================================================================

export type ParsedSection = {
  headingLevel: number
  headingText: string
  bodyText: string
  sectionOrder: number
  contentHash: string
}

// =============================================================================
// Rich render AST types
// =============================================================================

export type RichTextRun = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  linkUrl?: string
}

export type RichBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; runs: RichTextRun[] }
  | { type: 'paragraph'; runs: RichTextRun[] }
  | {
      type: 'list-item'
      ordered: boolean
      nestingLevel: number
      runs: RichTextRun[]
    }
  | { type: 'table'; rows: Array<{ cells: Array<{ blocks: RichBlock[] }> }> }
  | { type: 'section-break' }
