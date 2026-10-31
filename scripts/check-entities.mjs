#!/usr/bin/env node
/**
 * Keeps the entity registry honest (run by `npm run lint`). Fails when an
 * entity in apps/internal/lib/entity-accents.ts:
 *   - lacks an icon or a colour token,
 *   - shares its icon with another entity,
 *   - has no `--entity-<token>` value in theme.css for light or dark,
 *   - or its colour is under 3:1 on a card in either theme (WCAG 1.4.11).
 * And fails when a status colour (success, warning, destructive) sits within
 * ΔE_OK 0.06 of any entity colour in either theme, so a green check never
 * reads as a client badge (and a red error never reads as a person).
 * Imports of entity icons outside the registry are blocked by eslint
 * (apps/internal/eslint.config.mjs reads the same icon list).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const registry = readFileSync(
  `${root}apps/internal/lib/entity-accents.ts`,
  'utf8'
)
const theme = readFileSync(`${root}packages/ui/src/styles/theme.css`, 'utf8')

const MIN_CONTRAST = 3
const CARD = { light: [1, 0, 0], dark: [0.205, 0, 0] }

const body = registry.slice(registry.indexOf('export const ENTITIES'))
const entities = [
  ...body.matchAll(/^ {2}(\w+): \{\n([\s\S]*?)\n {2}\},$/gm),
].map(([, key, block]) => ({
  key,
  icon: block.match(/^ {4}icon: (\w+),$/m)?.[1],
  iconName: block.match(/^ {4}iconName: '(\w+)',$/m)?.[1],
  token: block.match(/^ {4}token: '([\w-]+)',$/m)?.[1],
}))

function tokensIn(selector) {
  const start = theme.indexOf(`${selector} {`)
  const block = theme.slice(start, theme.indexOf('}', start))
  return new Map(
    [...block.matchAll(/--entity-([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2]])
  )
}
const values = { light: tokensIn(':root'), dark: tokensIn('.dark') }

/** Status tokens, by theme: --success, --warning, --destructive. */
const STATUS = ['success', 'warning', 'destructive']
function statusIn(selector) {
  const start = theme.indexOf(`${selector} {`)
  const block = theme.slice(start, theme.indexOf('}', start))
  return new Map(
    STATUS.map(name => [
      name,
      block.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1],
    ])
  )
}
const statuses = { light: statusIn(':root'), dark: statusIn('.dark') }
const MIN_STATUS_DISTANCE = 0.06

/** OKLab of an oklch() value, for ΔE_OK. */
function oklab(value) {
  const m = value?.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) return null
  const l = Number(m[1]) / (m[2] ? 100 : 1)
  const c = Number(m[3])
  const h = (Number(m[4]) * Math.PI) / 180
  return [l, c * Math.cos(h), c * Math.sin(h)]
}
const deltaE = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])

function luminance(value) {
  const m = value.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) return null
  const l = Number(m[1]) / (m[2] ? 100 : 1)
  const c = Number(m[3])
  const h = (Number(m[4]) * Math.PI) / 180
  return luminanceOf([l, c * Math.cos(h), c * Math.sin(h)])
}
function luminanceOf([l, a, b]) {
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clip = x => Math.min(1, Math.max(0, x))
  const r = clip(4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp)
  const g = clip(-1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp)
  const bl = clip(-0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}
const ratio = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)

const errors = []
if (entities.length === 0) errors.push('no entities found in the registry')
const byIcon = new Map()
for (const entity of entities) {
  if (!entity.icon || !entity.iconName) {
    errors.push(`${entity.key}: no icon`)
  } else {
    if (entity.icon !== entity.iconName) {
      errors.push(
        `${entity.key}: iconName '${entity.iconName}' ≠ icon ${entity.icon}`
      )
    }
    if (byIcon.has(entity.icon)) {
      errors.push(
        `${entity.key}: shares ${entity.icon} with ${byIcon.get(entity.icon)}`
      )
    }
    byIcon.set(entity.icon, entity.key)
  }
  if (!entity.token) {
    errors.push(`${entity.key}: no colour token`)
    continue
  }
  for (const mode of ['light', 'dark']) {
    const value = values[mode].get(entity.token)
    if (!value) {
      errors.push(
        `${entity.key}: --entity-${entity.token} missing in ${mode} (theme.css)`
      )
      continue
    }
    const lum = luminance(value)
    if (lum === null) {
      errors.push(
        `${entity.key}: --entity-${entity.token} (${mode}) is not oklch()`
      )
      continue
    }
    const contrast = ratio(lum, luminanceOf(CARD[mode]))
    if (contrast < MIN_CONTRAST) {
      errors.push(
        `${entity.key}: ${contrast.toFixed(2)}:1 on card in ${mode}, needs ${MIN_CONTRAST}:1`
      )
    }
  }
}

for (const mode of ['light', 'dark']) {
  for (const status of STATUS) {
    const statusLab = oklab(statuses[mode].get(status))
    if (!statusLab) {
      errors.push(`--${status} (${mode}) is missing or not oklch()`)
      continue
    }
    for (const entity of entities) {
      const entityLab = oklab(values[mode].get(entity.token))
      if (!entityLab) continue
      const distance = deltaE(statusLab, entityLab)
      if (distance < MIN_STATUS_DISTANCE) {
        errors.push(
          `--${status} is ΔE ${distance.toFixed(3)} from ${entity.key} in ${mode}; keep status colours ≥ ${MIN_STATUS_DISTANCE} from every entity`
        )
      }
    }
  }
}

if (errors.length) {
  console.error('Entity registry check failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(
  `Entity registry: ${entities.length} entities, icons unique, contrast ≥ ${MIN_CONTRAST}:1 in both themes, status colours ≥ ΔE ${MIN_STATUS_DISTANCE} from every entity`
)
