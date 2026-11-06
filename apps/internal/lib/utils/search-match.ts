/**
 * Plain-text matching for cmdk-powered pickers.
 *
 * cmdk's default filter is a fuzzy scorer: any option whose text contains the
 * typed letters *in order* survives, so "Sales" matched "Bass Marketing /
 * Landing pages" (s…a…l…e…s). For a list of named records that is noise —
 * people type a word they remember from the label, not a letter sequence.
 *
 * This filter treats the query as whitespace-separated tokens and requires
 * every token to appear as a contiguous substring of the option text (label
 * plus keywords). Matches are ranked so exact and prefix hits float above
 * mid-word hits; ties keep the caller's order because cmdk's sort is stable.
 *
 * Two forgiving fallbacks rank below every plain match, so they only add
 * options and never reorder the ones a plain search finds:
 * - spacing: "warmintro" finds "Warm Intro" and "warm intro" finds
 *   "WarmIntro" (the text compared with its spaces taken out);
 * - one slip per word: a word of 4+ letters that starts with the right
 *   letter may have one letter wrong, missing, extra or swapped ("smtih"
 *   finds "Smith"). Keeping the first letter fixed stops "sales" matching
 *   "tales".
 */

const normalize = (input: string) =>
  input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // "O'Brien" and "obrien" are the same name.
    .replace(/['\u2019]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const isWordStart = (haystack: string, index: number) =>
  index === 0 || !/[\p{L}\p{N}]/u.test(haystack[index - 1] ?? '')

const wordStartIndex = (haystack: string, needle: string) => {
  let from = 0
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from)
    if (index === -1) {
      return -1
    }
    if (isWordStart(haystack, index)) {
      return index
    }
    from = index + 1
  }
  return -1
}

export const SEARCH_SCORE = {
  exact: 1,
  prefix: 0.9,
  phraseAtWordStart: 0.8,
  tokensAtWordStart: 0.7,
  substring: 0.5,
  spacing: 0.3,
  typo: 0.2,
  none: 0,
} as const

/**
 * Score how well `search` matches `value` (+ optional `keywords`).
 * Returns 0 for no match; higher is better. Shaped as a cmdk `filter`.
 */
export function scoreSearchMatch(
  value: string,
  search: string,
  keywords?: string[]
): number {
  const query = normalize(search)
  if (query.length === 0) {
    return SEARCH_SCORE.exact
  }

  const label = normalize(value)
  const haystack = normalize([value, ...(keywords ?? [])].join(' '))
  const tokens = query.split(' ')

  if (!tokens.every(token => haystack.includes(token))) {
    return forgivingScore(haystack, query, tokens)
  }

  if (label === query) {
    return SEARCH_SCORE.exact
  }

  if (label.startsWith(query)) {
    return SEARCH_SCORE.prefix
  }

  if (wordStartIndex(haystack, query) !== -1) {
    return SEARCH_SCORE.phraseAtWordStart
  }

  if (tokens.every(token => wordStartIndex(haystack, token) !== -1)) {
    return SEARCH_SCORE.tokensAtWordStart
  }

  return SEARCH_SCORE.substring
}

/**
 * The hint to show under an option that matched through one of its `hints`
 * (a company found by one of its people) rather than its own text: the
 * best-matching hint, else the one holding most typed words the option's
 * own text lacks. Null when the label
 * or keywords match on their own, so a plain match shows no hint.
 */
export function matchedHint(
  label: string,
  keywords: readonly string[] | undefined,
  hints: readonly string[] | undefined,
  search: string
): string | null {
  if (!hints?.length || normalize(search).length === 0) return null
  if (scoreSearchMatch(label, search, keywords ? [...keywords] : undefined)) {
    return null
  }
  let best: string | null = null
  let bestScore: number = SEARCH_SCORE.none
  for (const hint of hints) {
    const score = scoreSearchMatch(hint, search)
    if (score > bestScore) {
      best = hint
      bestScore = score
    }
  }
  if (best) return best
  // The words split between the option and a hint: name the hint holding
  // most of the words the option's own text lacks.
  const own = [label, ...(keywords ?? [])]
  const missing = normalize(search)
    .split(' ')
    .filter(token => !scoreSearchMatch(label, token, [...own]))
  let mostCount = 0
  for (const hint of hints) {
    const count = missing.filter(token => scoreSearchMatch(hint, token)).length
    if (count > mostCount) {
      best = hint
      mostCount = count
    }
  }
  return best
}

/** Shortest query a fallback applies to: shorter ones match too much. */
const MIN_FORGIVING_LENGTH = 4

const WORD_SPLIT = /[^\p{L}\p{N}]+/u

/** The fallbacks for a query a plain search doesn't match. */
function forgivingScore(
  haystack: string,
  query: string,
  tokens: string[]
): number {
  const compactQuery = query.replace(/ /g, '')
  if (
    compactQuery.length >= MIN_FORGIVING_LENGTH &&
    haystack.replace(/ /g, '').includes(compactQuery)
  ) {
    return SEARCH_SCORE.spacing
  }

  const words = haystack.split(WORD_SPLIT).filter(Boolean)
  const tokenMatches = (token: string) =>
    haystack.includes(token) ||
    (token.length >= MIN_FORGIVING_LENGTH &&
      words.some(word => startsWithOneSlip(word, token)))

  return tokens.every(tokenMatches) ? SEARCH_SCORE.typo : SEARCH_SCORE.none
}

/**
 * Whether `word` starts with `token` give or take one slip (a letter wrong,
 * missing, extra or two swapped), keeping the first letter.
 */
function startsWithOneSlip(word: string, token: string): boolean {
  if (word[0] !== token[0]) return false
  for (const length of [token.length - 1, token.length, token.length + 1]) {
    if (length > word.length) break
    if (editDistance(token, word.slice(0, length)) <= 1) return true
  }
  return false
}

/** Optimal string alignment distance (Levenshtein plus swaps). */
function editDistance(a: string, b: string): number {
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2]![j - 2]! + 1)
      }
      rows[i]![j] = best
    }
  }
  return rows[a.length]![b.length]!
}
