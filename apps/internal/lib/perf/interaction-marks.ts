import type { InteractionEventName } from '@/lib/posthog/types'

export type InteractionMetadata = Record<string, unknown>
export type InteractionProperties = Record<string, unknown>

type InteractionEmitPayload = {
  name: InteractionEventName
  metadata?: InteractionMetadata
  properties?: InteractionProperties
  duration?: number
}

type InteractionOptions = {
  metadata?: InteractionMetadata
  onEmit?: (payload: InteractionEmitPayload) => void
}

export type InteractionHandle = {
  name: InteractionEventName
  end: (properties?: InteractionProperties) => InteractionEmitPayload
}

const performanceApi =
  typeof globalThis !== 'undefined' && globalThis.performance
    ? globalThis.performance
    : undefined

/**
 * Times one interaction. The start time is held by the handle, not by a
 * named performance mark: marks are global, so two interactions starting in
 * the same millisecond (a bulk action's rows, two people saving at once)
 * would share a name, and the first to end would clear the other's mark.
 */
export function startInteraction(
  name: InteractionEventName,
  options?: InteractionOptions
): InteractionHandle {
  const startedAt = performanceApi?.now()

  return {
    name,
    end: (properties?: InteractionProperties) => {
      const duration =
        startedAt === undefined || !performanceApi
          ? undefined
          : performanceApi.now() - startedAt

      const payload: InteractionEmitPayload = {
        name,
        metadata: options?.metadata,
        properties,
        duration,
      }

      options?.onEmit?.(payload)

      return payload
    },
  }
}
