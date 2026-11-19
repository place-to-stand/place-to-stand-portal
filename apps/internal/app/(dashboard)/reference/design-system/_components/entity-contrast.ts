import { ENTITIES, type AccentEntity } from '@/lib/entity-accents'

import { COLOR_TOKENS, darkValue, lightValue } from './tokens'

/**
 * Each entity's live colour (its `--entity-*` token from tokens.json) and its
 * icon-on-card contrast in both themes, measured from OKLCH.
 * scripts/check-entities.mjs runs the same sum in lint.
 */

type Oklch = [number, number, number]

/** `--card` in each theme (theme.css): white, and oklch(0.205 0 0). */
const CARD_LIGHT: Oklch = [1, 0, 0]
const CARD_DARK: Oklch = [0.205, 0, 0]

/** Non-text (icon) contrast target, WCAG 1.4.11. */
export const CONTRAST_TARGET = 3

function parseOklch(value: string): Oklch {
  const match = value.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/)
  if (!match) throw new Error(`Not an OKLCH colour: ${value}`)
  const lightness = Number(match[1]) / (match[2] ? 100 : 1)
  return [lightness, Number(match[3]), Number(match[4])]
}

/** Relative luminance of an OKLCH colour, clipped to sRGB. */
function luminance([l, c, h]: Oklch) {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clip = (x: number) => Math.min(1, Math.max(0, x))
  const r = clip(4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp)
  const g = clip(-1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp)
  const bl = clip(-0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

function contrastRatio(fg: Oklch, bg: Oklch) {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export type EntityColour = {
  token: string
  light: string
  dark: string
  lightContrast: number
  darkContrast: number
}

export function entityColour(entity: AccentEntity): EntityColour {
  const token = `entity-${ENTITIES[entity].token}`
  const found = COLOR_TOKENS.find(candidate => candidate.name === token)
  if (!found) throw new Error(`Missing colour token ${token}`)
  const light = lightValue(found.value)
  const dark = darkValue(found.value)
  return {
    token,
    light,
    dark,
    lightContrast: contrastRatio(parseOklch(light), CARD_LIGHT),
    darkContrast: contrastRatio(parseOklch(dark), CARD_DARK),
  }
}
