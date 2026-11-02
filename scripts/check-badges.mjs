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
import { fileURLToPath } from 'node:url'

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

const errors = []
for (const dir of DIRS) {
  for (const file of files(join(root, dir))) {
    const source = readFileSync(file, 'utf8')
    for (const tag of source.matchAll(/<Badge\b[^>]*>/gs)) {
      const hits = [...tag[0].matchAll(FORBIDDEN)].map(m => m[1])
      if (hits.length) {
        const line = source.slice(0, tag.index).split('\n').length
        errors.push(`${file.slice(root.length)}:${line}: ${[...new Set(hits)].join(', ')}`)
      }
    }
  }
}

if (errors.length) {
  console.error('Badge check failed: badges take size, weight and case from @pts/ui/badge.')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('Badges: one size, weight and case everywhere (set by @pts/ui/badge)')
