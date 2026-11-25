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
 * It reads every tracked file's path and text (UTF-8, or UTF-16 by its
 * byte-order mark), not just the PR's changes, so an old leak fails too.
 * Names are matched whole-word, ignoring case, accents written either way,
 * fullwidth letters and invisible characters, across spaces, underscores,
 * dots, hyphens, &nbsp; and %20.
 *
 * It misses: a name split across two lines, run together ("DoeJane") or
 * reversed ("Doe, Jane"); list each form you worry about. It can't read
 * images, so screenshots stay with review. History and commit messages
 * aren't checked.
 */
import { readFileSync, statSync } from 'node:fs'

import { escape, git, isMain } from './shared.mjs'

// Files no person reads, generated from others.
const SKIPPED = [/(^|\/)package-lock\.json$/]
// Larger text files are still read, with a warning that they were large.
const LARGE_BYTES = 20 * 1024 * 1024

/**
 * Text as the check compares it: compatibility forms folded (fullwidth
 * letters, composed accents) and invisible characters that can split a name
 * removed (zero-width spaces and joiners, soft hyphens, BOM).
 */
export function normalize(text) {
  return text.normalize('NFKC').replace(/[­​-‍⁠﻿]/g, '')
}

// What may sit between the words of an entry: spaces, underscores, dots,
// hyphens, a non-breaking space written as HTML or a URL-encoded space.
// So "Jane Doe" matches "jane_doe", "jane.doe@…", "Jane&nbsp;Doe", "Jane%20Doe".
const BETWEEN = '(?:[\\s_.\\-]|&nbsp;|%20)+'
const WORD = /[\p{L}\p{N}]/u

/** `REAL_NAMES` as matchers, each with its line number on the list. */
export function parseList(text) {
  return normalize(text ?? '')
    .split(/\r?\n/)
    .map((raw, index) => ({ entry: raw.trim(), number: index + 1 }))
    .filter(({ entry }) => entry && !entry.startsWith('#'))
    .map(({ entry, number }) => {
      const body = entry.split(/\s+/).map(escape).join(BETWEEN)
      // Whole words only, so a short name doesn't match inside another word.
      // An entry that starts or ends with punctuation ("@client.com") needs
      // no boundary on that side.
      const before = WORD.test(entry[0]) ? '(?<![\\p{L}\\p{N}])' : ''
      const after = WORD.test(entry.at(-1)) ? '(?![\\p{L}\\p{N}])' : ''
      return { number, pattern: new RegExp(before + body + after, 'iu') }
    })
}

/**
 * Each hit as { file, line, number }; never the matched text. `line` 0 means
 * the file's path itself names someone.
 */
export function findHits(files, list) {
  const hits = []
  for (const { file, text } of files) {
    const path = normalize(file)
    for (const { number, pattern } of list) {
      if (pattern.test(path)) hits.push({ file, line: 0, number })
    }
    normalize(text)
      .split('\n')
      .forEach((content, index) => {
        for (const { number, pattern } of list) {
          if (pattern.test(content)) {
            hits.push({ file, line: index + 1, number })
          }
        }
      })
  }
  return hits
}

/** A buffer as text: UTF-16 by its byte-order mark, else UTF-8; null if binary. */
function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer)
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer)
  }
  // A NUL byte early on means binary (images, fonts).
  if (buffer.subarray(0, 8000).includes(0)) return null
  return buffer.toString('utf8')
}

/** Every tracked file as { file, index, text }; binaries keep only the path. */
function readTracked() {
  return git('ls-files', '-z')
    .split('\0')
    .filter(Boolean)
    .map((file, index) => ({ file, index: index + 1 }))
    .filter(({ file }) => !SKIPPED.some(re => re.test(file)))
    .map(({ file, index }) => {
      try {
        if (statSync(file).size > LARGE_BYTES) {
          console.log(
            `::warning title=Large file::${annotationText(file)} is over 20 MB; it was still checked, but large data files belong outside the repo.`
          )
        }
        return { file, index, text: decode(readFileSync(file)) ?? '' }
      } catch {
        // Deleted in the working tree, or a submodule: only the path.
        return { file, index, text: '' }
      }
    })
}

// Annotation values can't carry raw % , : or newlines.
function annotationText(text) {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}
function annotationProperty(text) {
  return annotationText(text).replace(/:/g, '%3A').replace(/,/g, '%2C')
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
  const files = readTracked()
  const indexOf = new Map(files.map(({ file, index }) => [file, index]))
  const hits = findHits(files, list)
  if (hits.length === 0) {
    console.log(`Made-up data check passed: ${list.length} entries, no hits.`)
    return
  }
  for (const { file, line, number } of hits.slice(0, 50)) {
    if (line === 0) {
      // Printing this path would publish the name: give its place in
      // `git ls-files` instead.
      console.log(
        `::error title=Real name in a file name::File ${indexOf.get(file)} in \`git ls-files\` has a name that matches entry ${number} on the REAL_NAMES list. Rename it. Find it with: git ls-files | sed -n '${indexOf.get(file)}p'`
      )
      continue
    }
    console.log(
      `::error file=${annotationProperty(file)},line=${line},title=Real name::Line ${line} matches entry ${number} on the REAL_NAMES list. Replace it with made-up data.`
    )
  }
  console.error(
    `${hits.length} place(s) name a real client, person or email from the REAL_NAMES list.`
  )
  process.exit(1)
}

if (isMain(import.meta.url)) main()
