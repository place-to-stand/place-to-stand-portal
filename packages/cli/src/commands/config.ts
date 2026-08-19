import type { Command } from 'commander'

import { configPath, credentialsPath, writeApiUrl } from '../config.js'
import { resolveApiContext } from '../context.js'
import { emit, emitMessage } from '../output.js'

export function registerConfigCommands(program: Command): void {
  const config = program
    .command('config')
    .description('Inspect and set CLI configuration')

  config
    .command('show', { isDefault: true })
    .description('Show the resolved portal URL and config file locations')
    .action(async () => {
      emit({
        apiUrl: await resolveApiContext(),
        configPath,
        credentialsPath,
      })
    })

  config
    .command('set-url <url>')
    .description('Persist the default portal URL to ~/.pts/config.json')
    .action(async (url: string) => {
      const saved = await writeApiUrl(url)

      emitMessage(`Default portal URL set to ${saved}.`)
    })
}
