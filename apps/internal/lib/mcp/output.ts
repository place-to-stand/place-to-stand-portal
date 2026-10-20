import 'server-only'

import { z } from 'zod'

import { htmlToPlainText } from '@/lib/activity/text-diff'

/**
 * Output bounds (PRD 009 §4): a list never floods the model's context. Lists
 * are limit-capped rather than cursor-paged — `hasMore` tells the agent to
 * narrow its filters, which is what it should do anyway.
 */
export const listLimit = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(25)
  .describe('Maximum results, 1–100. Default 25.')

export const searchText = z
  .string()
  .trim()
  .min(1)
  .describe('Case-insensitive text match.')

/**
 * `rows` should be fetched with `limit + 1` so one extra row answers
 * "is there more" without a count query.
 */
export function page<T>(rows: T[], limit: number) {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit }
}

const LIST_TEXT_MAX = 400

/**
 * Long rich-text fields in list results, as a plain-text preview: stripping
 * the editor HTML first means a cut can never leave a tag open, and every
 * preview reads the same whether or not it was cut. The `get_*` tool for the
 * same entity returns the full stored HTML, and the marker says so.
 */
export function clip(text: string | null, getTool: string): string | null {
  if (!text) {
    return text
  }

  const plain = htmlToPlainText(text)

  if (plain.length <= LIST_TEXT_MAX) {
    return plain
  }

  return `${plain.slice(0, LIST_TEXT_MAX)}… [truncated; call ${getTool} for the full text]`
}
