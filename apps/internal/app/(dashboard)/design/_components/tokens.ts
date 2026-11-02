/**
 * The design tokens, read from docs/design-system/tokens.json. That file's
 * colour values and radii are generated from packages/ui/src/styles/theme.css
 * (`npm run design-tokens`, checked by lint), so the swatches and scales on
 * this page show exactly what the theme ships, with the usage notes beside.
 */
import tokensJson from '../../../../../../docs/design-system/tokens.json'

export type ThemedValue = string | { light: string; dark: string }

export type ColorToken = { name: string; value: ThemedValue; usage: string }

export type ScaleToken = { name: string; value: ThemedValue; usage: string }

export type TypeStyle = {
  name: string
  fontSize: string
  lineHeight: string
  fontWeight: number
  letterSpacing?: string
  textTransform?: string
  sample: string
  usage: string
}

export type TypeGroup = {
  name: string
  family: string
  note: string
  styles: TypeStyle[]
}

const tokens = tokensJson as unknown as {
  color: { tokens: ColorToken[] }
  type: { families: Record<string, string>; groups: TypeGroup[] }
  spacing: { note: string; tokens: ScaleToken[] }
  radius: { note: string; tokens: ScaleToken[] }
  size: { note: string; tokens: ScaleToken[] }
  shadow: { note: string; tokens: ScaleToken[] }
  opacity: { tokens: ScaleToken[] }
}

export const COLOR_TOKENS = tokens.color.tokens
export const TYPE_GROUPS = tokens.type.groups
export const SPACING = tokens.spacing
export const RADII = tokens.radius
export const SIZES = tokens.size
export const SHADOWS = tokens.shadow
export const OPACITIES = tokens.opacity

export function lightValue(value: ThemedValue) {
  return typeof value === 'string' ? value : value.light
}

export function darkValue(value: ThemedValue) {
  return typeof value === 'string' ? value : value.dark
}
