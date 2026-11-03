#!/usr/bin/env node
/**
 * Keeps badges one family (run by `npm run lint`). Every <Badge> in both apps
 * takes its size, weight and case from @pts/ui/badge: fails on a Badge whose
 * classes change the case (uppercase), letter spacing, font weight, text size,
 * height, vertical padding or radius. Colour (a status tint or an entity
 * accent) and layout (gap, margin, shrink) are fine.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const DIRS = ['apps/internal/app', 'apps/internal/components', 'apps/internal/lib', 'apps/client']
const SKIP = /node_modules|\.next|tiptap/
const FORBIDDEN =
  /(?<![\w:-])(uppercase|lowercase|capitalize|tracking-[\w-]+|font-(?:thin|light|normal|semibold|bold|extrabold|black)|text-(?:\[[^\]]+\]|sm|base|lg|xl|2xs)|h-\d+(?:\.\d+)?|py-\d+(?:\.\d+)?|rounded-(?:none|sm|md|lg|xl))(?![\w-])/g

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (SKIP.test(path)) continue
    if (statSync(path).isDirectory()) yield* files(path)
    else if (path.endsWith('.tsx')) yield path
  }
}

/** Each <Badge> in `source` that changes size, weight or case: its line and the classes. */
export function checkBadges(source) {
  const found = []
  for (const tag of source.matchAll(/<Badge\b[^>]*>/gs)) {
    const hits = [...tag[0].matchAll(FORBIDDEN)].map(m => m[1])
    if (hits.length) {
      const line = source.slice(0, tag.index).split('\n').length
      found.push({ line, classes: [...new Set(hits)] })
    }
  }
  return found
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

const errors = []
if (isMain) {
  for (const dir of DIRS) {
    for (const file of files(join(root, dir))) {
      for (const { line, classes } of checkBadges(readFileSync(file, 'utf8'))) {
        errors.push(`${file.slice(root.length)}:${line}: ${classes.join(', ')}`)
      }
    }
  }
}

if (!isMain) {
  // Imported by the tests: nothing to report.
} else if (errors.length) {
  console.error('Badge check failed: badges take size, weight and case from @pts/ui/badge.')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
else console.log('Badges: one size, weight and case everywhere (set by @pts/ui/badge)')
