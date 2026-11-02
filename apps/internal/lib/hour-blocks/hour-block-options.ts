import type { HourBlockClient } from './hour-block-form'

export type ClientOption = {
  value: string
  label: string
  keywords: string[]
}

export const buildClientOptions = (
  clients: HourBlockClient[]
): ClientOption[] =>
  clients.map(client => ({
    value: client.id,
    label: client.deleted_at ? `${client.name} (Archived)` : client.name,
    keywords: client.deleted_at ? [client.name, 'archived'] : [client.name],
  }))
