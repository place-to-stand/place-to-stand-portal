import 'server-only'

import { getValidAccessToken } from '@/lib/gmail/client'

// =============================================================================
// Types
// =============================================================================

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DOCS_API_BASE = 'https://docs.googleapis.com/v1'

export interface Range {
  startIndex: number
  endIndex: number
}

export interface ParagraphStyle {
  namedStyleType?: 'NORMAL_TEXT' | 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'HEADING_4' | 'TITLE'
  alignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFIED'
  spaceAbove?: { magnitude: number; unit: 'PT' }
  spaceBelow?: { magnitude: number; unit: 'PT' }
  lineSpacing?: number
  indentFirstLine?: { magnitude: number; unit: 'PT' }
  indentStart?: { magnitude: number; unit: 'PT' }
}

export interface TextStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: { magnitude: number; unit: 'PT' }
  foregroundColor?: { color: { rgbColor: { red?: number; green?: number; blue?: number } } }
  weightedFontFamily?: { fontFamily: string }
  link?: { url: string }
}

export interface TableCellStyle {
  backgroundColor?: { color: { rgbColor: { red?: number; green?: number; blue?: number } } }
  paddingTop?: { magnitude: number; unit: 'PT' }
  paddingBottom?: { magnitude: number; unit: 'PT' }
  paddingLeft?: { magnitude: number; unit: 'PT' }
  paddingRight?: { magnitude: number; unit: 'PT' }
}

// Google Docs API request types
export type DocumentRequest =
  | { insertText: { location: { index: number }; text: string } }
  | { updateParagraphStyle: { range: Range; paragraphStyle: ParagraphStyle; fields: string } }
  | { updateTextStyle: { range: Range; textStyle: TextStyle; fields: string } }
  | { insertTable: { location: { index: number }; rows: number; columns: number } }
  | { createParagraphBullets: { range: Range; bulletPreset: string } }
  | { deleteParagraphBullets: { range: Range } }
  | { insertTableRow: { tableCellLocation: { tableStartLocation: { index: number }; rowIndex: number; columnIndex: number }; insertBelow: boolean } }
  | { insertTableColumn: { tableCellLocation: { tableStartLocation: { index: number }; rowIndex: number; columnIndex: number }; insertRight: boolean } }
  | { updateTableCellStyle: { tableRange: { tableCellLocation: { tableStartLocation: { index: number }; rowIndex: number; columnIndex: number }; rowSpan: number; columnSpan: number }; tableCellStyle: TableCellStyle; fields: string } }
  | { updateTableColumnProperties: { tableStartLocation: { index: number }; columnIndices: number[]; tableColumnProperties: { widthType: string; width?: { magnitude: number; unit: string } }; fields: string } }

// =============================================================================
// Core Document Operations
// =============================================================================

/**
 * Create a blank Google Doc.
 */
export async function createBlankDocument(
  userId: string,
  title: string,
  options?: { connectionId?: string }
): Promise<{ docId: string; docUrl: string }> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  // Create a blank document using Drive API
  const res = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.document',
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to create document: ${errorText}`)
  }

  const data = await res.json()
  const docId = data.id as string

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
  }
}

/**
 * Execute batch update requests on a Google Doc.
 */
export async function batchUpdateDocument(
  userId: string,
  docId: string,
  requests: DocumentRequest[],
  options?: { connectionId?: string }
): Promise<void> {
  if (requests.length === 0) return

  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = `${DOCS_API_BASE}/documents/${encodeURIComponent(docId)}:batchUpdate`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to batch update document: ${errorText}`)
  }
}

/**
 * Get a document's content for inspection/debugging.
 */
export async function getDocumentContent(
  userId: string,
  docId: string,
  options?: { connectionId?: string }
): Promise<unknown> {
  const { accessToken } = await getValidAccessToken(userId, options?.connectionId)

  const url = `${DOCS_API_BASE}/documents/${encodeURIComponent(docId)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to get document: ${errorText}`)
  }

  return res.json()
}

// =============================================================================
// Request Builders
// =============================================================================

/**
 * Build an insertText request.
 */
export function insertTextRequest(index: number, text: string): DocumentRequest {
  return {
    insertText: {
      location: { index },
      text,
    },
  }
}

/**
 * Build an updateParagraphStyle request.
 */
export function updateParagraphStyleRequest(
  range: Range,
  style: ParagraphStyle
): DocumentRequest {
  const fields = Object.keys(style).join(',')
  return {
    updateParagraphStyle: {
      range,
      paragraphStyle: style,
      fields,
    },
  }
}

/**
 * Build an updateTextStyle request.
 */
export function updateTextStyleRequest(range: Range, style: TextStyle): DocumentRequest {
  // Build fields string from style keys, handling nested properties
  const fieldParts: string[] = []
  if (style.bold !== undefined) fieldParts.push('bold')
  if (style.italic !== undefined) fieldParts.push('italic')
  if (style.underline !== undefined) fieldParts.push('underline')
  if (style.fontSize !== undefined) fieldParts.push('fontSize')
  if (style.foregroundColor !== undefined) fieldParts.push('foregroundColor')
  if (style.weightedFontFamily !== undefined) fieldParts.push('weightedFontFamily')
  if (style.link !== undefined) fieldParts.push('link')

  return {
    updateTextStyle: {
      range,
      textStyle: style,
      fields: fieldParts.join(','),
    },
  }
}

/**
 * Build an insertTable request.
 */
export function insertTableRequest(index: number, rows: number, columns: number): DocumentRequest {
  return {
    insertTable: {
      location: { index },
      rows,
      columns,
    },
  }
}

/**
 * Build a createParagraphBullets request.
 */
export function createParagraphBulletsRequest(
  range: Range,
  preset: string = 'BULLET_DISC_CIRCLE_SQUARE'
): DocumentRequest {
  return {
    createParagraphBullets: {
      range,
      bulletPreset: preset,
    },
  }
}

/**
 * Build an updateTableCellStyle request.
 */
export function updateTableCellStyleRequest(
  tableStartIndex: number,
  rowIndex: number,
  columnIndex: number,
  rowSpan: number,
  columnSpan: number,
  style: TableCellStyle
): DocumentRequest {
  const fields = Object.keys(style).join(',')
  return {
    updateTableCellStyle: {
      tableRange: {
        tableCellLocation: {
          tableStartLocation: { index: tableStartIndex },
          rowIndex,
          columnIndex,
        },
        rowSpan,
        columnSpan,
      },
      tableCellStyle: style,
      fields,
    },
  }
}

/**
 * Build an updateTableColumnProperties request.
 */
export function updateTableColumnPropertiesRequest(
  tableStartIndex: number,
  columnIndices: number[],
  widthType: 'EVENLY_DISTRIBUTED' | 'FIXED_WIDTH',
  widthPt?: number
): DocumentRequest {
  const props: { widthType: string; width?: { magnitude: number; unit: string } } = { widthType }
  if (widthPt !== undefined) {
    props.width = { magnitude: widthPt, unit: 'PT' }
  }

  return {
    updateTableColumnProperties: {
      tableStartLocation: { index: tableStartIndex },
      columnIndices,
      tableColumnProperties: props,
      fields: widthType === 'FIXED_WIDTH' ? 'widthType,width' : 'widthType',
    },
  }
}

// =============================================================================
// Text Measurement Utilities
// =============================================================================

/**
 * Calculate the length of text including newlines.
 * Google Docs counts each character as 1, including newlines.
 */
export function textLength(text: string): number {
  return text.length
}

/**
 * Helper to track current insertion index and build requests.
 */
export class DocumentBuilder {
  private index: number
  private requests: DocumentRequest[] = []

  constructor(startIndex: number = 1) {
    this.index = startIndex
  }

  /**
   * Insert text and advance the index.
   */
  insertText(text: string): this {
    this.requests.push(insertTextRequest(this.index, text))
    this.index += textLength(text)
    return this
  }

  /**
   * Apply paragraph style to a range (does not advance index).
   */
  applyParagraphStyle(startIndex: number, endIndex: number, style: ParagraphStyle): this {
    this.requests.push(updateParagraphStyleRequest({ startIndex, endIndex }, style))
    return this
  }

  /**
   * Apply text style to a range (does not advance index).
   */
  applyTextStyle(startIndex: number, endIndex: number, style: TextStyle): this {
    this.requests.push(updateTextStyleRequest({ startIndex, endIndex }, style))
    return this
  }

  /**
   * Insert a table at the current index and advance.
   * Note: Tables add complexity to index tracking. After inserting a table,
   * the index advances by the table structure overhead.
   */
  insertTable(rows: number, columns: number): this {
    this.requests.push(insertTableRequest(this.index, rows, columns))
    // Table structure adds: 1 (table start) + rows * (1 + columns * 2) + 1 (table end)
    // This is an approximation - actual index depends on content
    this.index += 2 + rows * (1 + columns * 2)
    return this
  }

  /**
   * Apply bullets to a paragraph range.
   */
  applyBullets(startIndex: number, endIndex: number, preset?: string): this {
    this.requests.push(createParagraphBulletsRequest({ startIndex, endIndex }, preset))
    return this
  }

  /**
   * Get current index.
   */
  getCurrentIndex(): number {
    return this.index
  }

  /**
   * Set current index (useful after complex operations).
   */
  setIndex(index: number): this {
    this.index = index
    return this
  }

  /**
   * Add a raw request.
   */
  addRequest(request: DocumentRequest): this {
    this.requests.push(request)
    return this
  }

  /**
   * Get all accumulated requests.
   */
  getRequests(): DocumentRequest[] {
    return this.requests
  }

  /**
   * Clear requests and optionally reset index.
   */
  reset(startIndex: number = 1): this {
    this.requests = []
    this.index = startIndex
    return this
  }
}
