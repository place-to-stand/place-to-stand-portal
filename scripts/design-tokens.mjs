#!/usr/bin/env node
/**
 * Syncs docs/design-system/tokens.json with the code it describes.
 *
 * Reads the theme colors and radius scale from apps/internal/app/globals.css,
 * the brand colors from packages/ui/src/brand.tsx (BRAND) and the email colors
 * from packages/email/src/layout.ts (EMAIL_COLORS), and writes their values
 * into tokens.json. Usage notes and every hand-written family (type, spacing,
 * size, shadow, opacity) are kept as they are.
 *
 *   node scripts/design-tokens.mjs          rewrite tokens.json
 *   node scripts/design-tokens.mjs --check  exit 1 if tokens.json is stale
 *
 * Dependency-free on purpose: plain Node, regex over small, stable sources.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOKENS_PATH = join(ROOT, 'docs/design-system/tokens.json')
const NEW_TOKEN_USAGE = 'TODO: say where this token is used.'
/** Colors documented here that no source constant defines. */
const HAND_KEPT_COLORS = new Set([
  // Tailwind lime-600, used for the logo mark in the light theme.
  'brand-lime-600',
])

const read = path => readFileSync(join(ROOT, path), 'utf8')

/** `--name: value;` pairs of the first top-level block opened by `selector {`. */
function cssBlock(css, selector) {
  const start = css.indexOf(`\n${selector} {`)
  if (start === -1) throw new Error(`globals.css: no "${selector}" block`)
  const end = css.indexOf('\n}', start)
  const vars = new Map()
  for (const match of css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars.set(match[1], match[2].trim())
  }
  return vars
}

/** `key: '#hex'` pairs of `export const NAME = { … }` in a TS source. */
function tsColorConst(source, name, file) {
  const match = source.match(new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\n\\}`))
  if (!match) throw new Error(`${file}: no "export const ${name}"`)
  return new Map(
    [...match[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(m => [m[1], m[2]])
  )
}

const kebab = key => key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)

/** rem → px at a 16px root, the way the scale is documented. */
const remToPx = value => `${parseFloat(value) * 16}px`

function sourceColors() {
  const css = read('apps/internal/app/globals.css')
  const light = cssBlock(css, ':root')
  const dark = cssBlock(css, '.dark')
  const colors = new Map()

  for (const [name, value] of light) {
    if (name === 'radius') continue
    colors.set(name, { light: value, dark: dark.get(name) ?? value })
  }

  // BRAND.accent is the lime; gridDot is the same color as border.
  const brandNames = { accent: 'brand-lime', gridDot: null }
  const brand = tsColorConst(read('packages/ui/src/brand.tsx'), 'BRAND', 'brand.tsx')
  for (const [key, value] of brand) {
    const name = key in brandNames ? brandNames[key] : `brand-${kebab(key)}`
    if (name) colors.set(name, value)
  }

  const email = tsColorConst(
    read('packages/email/src/layout.ts'),
    'EMAIL_COLORS',
    'layout.ts'
  )
  for (const [key, value] of email) colors.set(`email-${kebab(key)}`, value)

  return { colors, css, radiusBase: light.get('radius') }
}

/** The base radius plus every `--radius-*` in @theme defined off it. */
function sourceRadii(css, base) {
  const basePx = parseFloat(remToPx(base))
  const radii = new Map([['radius', `${basePx}px`]])
  const pattern = /--(radius-\w+):\s*(?:calc\(var\(--radius\)\s*([+-])\s*(\d+)px\)|var\(--radius\));/g
  for (const [, name, sign, offset] of css.matchAll(pattern)) {
    const px = sign ? basePx + (sign === '+' ? 1 : -1) * Number(offset) : basePx
    radii.set(name, `${px}px`)
  }
  return radii
}

/**
 * Updates `family.tokens` from `values`: known names get the new value,
 * new names are appended with a TODO note, and names this script owns that
 * left the source are dropped. Tokens it does not own are left alone.
 */
function syncFamily(family, values, owns) {
  const next = []
  for (const token of family.tokens) {
    if (values.has(token.name)) {
      next.push({ ...token, value: values.get(token.name) })
    } else if (!owns(token.name)) {
      next.push(token)
    }
  }
  const present = new Set(next.map(token => token.name))
  for (const [name, value] of values) {
    if (!present.has(name)) next.push({ name, value, usage: NEW_TOKEN_USAGE })
  }
  return { ...family, tokens: next }
}

function build(current) {
  const { colors, css, radiusBase } = sourceColors()
  const ownsColor = name => !HAND_KEPT_COLORS.has(name)
  return {
    ...current,
    color: syncFamily(current.color, colors, ownsColor),
    radius: syncFamily(current.radius, sourceRadii(css, radiusBase), name =>
      ['radius', 'radius-sm', 'radius-md', 'radius-lg', 'radius-xl'].includes(name)
    ),
  }
}

const current = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'))
const next = build(current)

if (process.argv.includes('--check')) {
  if (!isDeepStrictEqual(current, next)) {
    console.error(
      'docs/design-system/tokens.json is out of date with globals.css / brand.tsx / layout.ts.\nRun `npm run design-tokens` and commit the result.'
    )
    process.exit(1)
  }
  console.log('design tokens: up to date')
} else {
  writeFileSync(TOKENS_PATH, `${JSON.stringify(next, null, 2)}\n`)
  const todos = next.color.tokens.filter(token => token.usage === NEW_TOKEN_USAGE)
  console.log(
    `design tokens: wrote ${TOKENS_PATH.replace(`${ROOT}/`, '')}` +
      (todos.length ? ` (${todos.length} new, add usage notes: ${todos.map(t => t.name).join(', ')})` : '')
  )
}
