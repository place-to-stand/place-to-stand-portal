#!/usr/bin/env node
/**
 * The repo is public and holds made-up data only. This fails when any
 * tracked file names a real client, person or email on the list in the
 * REAL_NAMES secret:
 *
 *   REAL_NAMES="…" node scripts/pr-checks/made-up-data.mjs
 *
 * REAL_NAMES has one entry per line: a name, company, email or domain (lines
 * starting with # are notes). The list lives in a GitHub secret because
 * writing it in the repo would publish it. For the same reason this never
 * prints what matched: only the file, the line and the entry's number on the
 * list (1 = first line).
 *
 * It reads every tracked text file, not just the PR's changes, so an old
 * leak fails too. It can't read images: screenshots stay with review.
 */
import { readFileSync, statSync } from 'node:fs'

import { escape, git, isMain } from './shared.mjs'

// Files no person reads, too large or generated to scan usefully.
const SKIPPED = [/(^|\/)package-lock\.json$/]
const MAX_BYTES = 2 * 1024 * 1024

/** `REAL_NAMES` as matchers, each with its line number on the list. */
export function parseList(text) {
  return (text ?? '')
    .split(/\r?\n/)
    .map((raw, index) => ({ entry: raw.trim(), number: index + 1 }))
    .filter(({ entry }) => entry && !entry.startsWith('#'))
    .map(({ entry, number }) => {
      // Words in an entry match across spaces, underscores or hyphens
      // ("Jane Doe", "jane_doe", "jane-doe"). Lines are scanned one at a time.
      const body = entry.split(/\s+/).map(escape).join('[\\s_-]+')
      // Whole words only, so a short name doesn't match inside another word.
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`,
        'iu'
      )
      return { number, pattern }
    })
}

/** Each hit as { file, line, number }; never the matched text. */
export function findHits(files, list) {
  const hits = []
  for (const { file, text } of files) {
    const lines = text.split('\n')
    lines.forEach((content, index) => {
      for (const { number, pattern } of list) {
        if (pattern.test(content)) hits.push({ file, line: index + 1, number })
      }
    })
  }
  return hits
}

function readTrackedText() {
  return git('ls-files', '-z')
    .split('\0')
    .filter(Boolean)
    .filter(file => !SKIPPED.some(re => re.test(file)))
    .flatMap(file => {
      try {
        if (statSync(file).size > MAX_BYTES) return []
        const buffer = readFileSync(file)
        // A NUL byte early on means binary (images, fonts): skip it.
        if (buffer.subarray(0, 8000).includes(0)) return []
        return [{ file, text: buffer.toString('utf8') }]
      } catch {
        // Deleted in the working tree, or a submodule: nothing to read.
        return []
      }
    })
}

function main() {
  const list = parseList(process.env.REAL_NAMES)
  if (list.length === 0) {
    // A fork's pull request gets no secrets, and a new install has no list.
    console.log(
      '::warning title=Made-up data check skipped::The REAL_NAMES secret is empty or missing, so no names were checked.'
    )
    return
  }
  const hits = findHits(readTrackedText(), list)
  if (hits.length === 0) {
    console.log(`Made-up data check passed: ${list.length} entries, no hits.`)
    return
  }
  for (const { file, line, number } of hits.slice(0, 50)) {
    console.log(
      `::error file=${file},line=${line},title=Real name::Line ${line} matches entry ${number} on the REAL_NAMES list. Replace it with made-up data.`
    )
  }
  console.error(
    `${hits.length} line(s) name a real client, person or email from the REAL_NAMES list.`
  )
  process.exit(1)
}

if (isMain(import.meta.url)) main()
