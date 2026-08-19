import type { Command } from 'commander'

import { signIn } from '../auth.js'
import { apiGet } from '../client.js'
import { clearCredentials, readCredentials } from '../config.js'
import { resolveApiContext } from '../context.js'
import { signInWithBrowser } from '../oauth.js'
import { emit, emitMessage } from '../output.js'
import { promptHidden, promptLine } from '../prompt.js'

type CliUser = {
  id: string
  email: string
  fullName: string | null
  role: string
}

type LoginOptions = {
  password?: boolean
  email?: string
}

/**
 * The browser flow is the default because it is the only one that works for an
 * admin who signs in with Google — they have no Supabase password to type.
 * The password flow stays for automation, where no browser can be opened.
 */
function wantsPasswordFlow(options: LoginOptions): boolean {
  return Boolean(
    options.password || options.email || process.env.PTS_PASSWORD
  )
}

async function passwordLogin(
  apiUrl: string,
  options: LoginOptions
): Promise<void> {
  // Prompting needs a terminal. Under CI, a pipe, or an agent harness there is
  // none, so require the non-interactive inputs up front rather than hanging on
  // a read that can never complete.
  const interactive = Boolean(process.stdin.isTTY)
  const email =
    options.email ??
    process.env.PTS_EMAIL ??
    (interactive ? await promptLine('Email: ') : '')
  // Read from the environment, never argv — argv shows up in the process list
  // for every other user on the machine.
  const password =
    process.env.PTS_PASSWORD ??
    (interactive ? await promptHidden('Password: ') : '')

  if (!email || !password) {
    throw new Error(
      interactive
        ? 'Email and password are both required.'
        : 'No terminal available for prompting. Pass --email (or set PTS_EMAIL) and set PTS_PASSWORD.'
    )
  }

  await signIn(apiUrl, email, password)
}

async function browserLogin(apiUrl: string): Promise<void> {
  if (!process.stdout.isTTY && !process.stderr.isTTY) {
    throw new Error(
      'Browser sign-in needs a terminal. For automation, set PTS_EMAIL and PTS_PASSWORD and pass --password.'
    )
  }

  emitMessage('Opening your browser to sign in…')

  await signInWithBrowser(apiUrl, url => {
    emitMessage(`If it did not open, visit:\n${url}\n`)
  })
}

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('Sign in to the portal and store credentials')
    .option(
      '--password',
      'Use email and password instead of the browser (for automation)'
    )
    .option('--email <email>', 'Skip the email prompt; implies --password')
    .action(async (options: LoginOptions) => {
      const apiUrl = await resolveApiContext()

      if (wantsPasswordFlow(options)) {
        await passwordLogin(apiUrl, options)
      } else {
        await browserLogin(apiUrl)
      }

      // The portal, not Supabase, decides who may use the CLI — a successful
      // sign-in still fails here for a non-ADMIN, with a JSON 403.
      const { data } = await apiGet<CliUser>('api/cli/v1/whoami')

      emitMessage(`Signed in to ${apiUrl} as ${data.email}.`)
      emit(data)
    })

  program
    .command('logout')
    .description('Remove stored credentials for the current portal')
    .action(async () => {
      const apiUrl = await resolveApiContext()
      const removed = await clearCredentials(apiUrl)

      emitMessage(
        removed
          ? `Signed out of ${apiUrl}.`
          : `No stored credentials for ${apiUrl}.`
      )
    })

  program
    .command('whoami')
    .description('Show the signed-in user')
    .action(async () => {
      const { data } = await apiGet<CliUser>('api/cli/v1/whoami')

      emit(data)
    })

  program
    .command('status')
    .description('Show the portal URL and whether credentials are stored')
    .action(async () => {
      const apiUrl = await resolveApiContext()
      const credentials = await readCredentials(apiUrl)

      emit({
        apiUrl,
        signedIn: Boolean(credentials),
        email: credentials?.email ?? null,
      })
    })
}
