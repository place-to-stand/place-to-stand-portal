import type { Json } from '@/lib/types/json'

export const joinWithCommas = (items: string[]): string => {
  if (items.length === 0) {
    return ''
  }

  if (items.length === 1) {
    return items[0]
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export const toMetadata = (
  value?: Record<string, unknown> | null
): Json | undefined => {
  if (!value || Object.keys(value).length === 0) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Json
}
