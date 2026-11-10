import { z } from 'zod'

/**
 * Tag names, shared by every kind of record that has tags. Client-safe.
 *
 * A tag is free text: spaces collapse, the first spelling typed is kept, and
 * names match without regard to case ("salon" reuses "Salon"). A comma ends
 * a tag as you type, so a name never holds one.
 */
export const TAG_NAME_MAX = 40
export const TAGS_PER_RECORD_MAX = 20

/**
 * Trimmed, with runs of spaces collapsed and commas dropped. Look-alike
 * forms fold to one (NFKC), and invisible and control characters go, so a
 * blank-looking tag or a second "Salon" with a hidden character can't exist.
 */
export function normalizeTagName(name: string): string {
  return (
    name
      .normalize('NFKC')
      .replace(/\p{Cf}/gu, '')
      // Variation selectors and the grapheme joiner: "Salon" plus one is
      // still "Salon".
      .replace(/[\u034F\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, '')
      // Fillers that draw as blank space (Hangul, Braille).
      .replace(/[\u115F\u1160\u3164\uFFA0\u2800]/g, ' ')
      .replace(/\p{Cc}/gu, ' ')
      .replace(/,/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** What two names compare by: "Non-profit" and " non-profit " are one tag. */
export function tagKey(name: string): string {
  return normalizeTagName(name).toLowerCase()
}

/** Normalized, blanks dropped, one per key (the first spelling wins). */
export function uniqueTagNames(names: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of names) {
    const name = normalizeTagName(raw)
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    result.push(name)
  }
  return result
}

/** Splits typed text on commas ("salon, spa" adds two tags). */
export function splitTagInput(text: string): string[] {
  return uniqueTagNames(text.split(','))
}

/** Same names, any order or case. */
export function sameTagNames(
  left: readonly string[],
  right: readonly string[]
): boolean {
  const a = new Set(left.map(tagKey))
  const b = new Set(right.map(tagKey))
  return a.size === b.size && [...a].every(key => b.has(key))
}

/** A record's full tag list, as a save sends it. */
export const tagNamesSchema = z
  .array(
    z
      .string()
      .transform(normalizeTagName)
      .pipe(
        z
          .string()
          .min(1, 'Tags cannot be blank')
          .max(TAG_NAME_MAX, `Tags must be ${TAG_NAME_MAX} characters or fewer`)
      )
  )
  .max(TAGS_PER_RECORD_MAX, `Up to ${TAGS_PER_RECORD_MAX} tags`)
  .transform(uniqueTagNames)

/** One tag a picker offers: its name and how many records carry it. */
export type TagOption = { id: string; name: string; count: number }

/** The kinds of record with tags (`tag_entity` in the database). */
export const TAG_ENTITIES = ['company'] as const
export type TagEntity = (typeof TAG_ENTITIES)[number]
export const isTagEntity = (value: string): value is TagEntity =>
  (TAG_ENTITIES as readonly string[]).includes(value)
