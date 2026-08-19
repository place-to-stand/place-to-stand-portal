import { spawn } from 'node:child_process'
import { createServer, type Server, type ServerResponse } from 'node:http'

import { createClient } from '@supabase/supabase-js'

import { ApiError, fetchPortalMeta } from './api.js'
import { writeCredentials, type StoredCredentials } from './config.js'

/**
 * Loopback redirect + PKCE — the same shape `gh`, `vercel` and the `supabase`
 * CLI use. The browser handles the identity provider (so Google, magic links
 * and anything added later all work unchanged), and hands an authorization
 * code back to a throwaway server this process owns.
 *
 * PKCE rather than the implicit flow is mandatory, not a preference: implicit
 * returns the token in the URL *fragment*, which a browser never transmits, so
 * the loopback server would receive nothing.
 */

/**
 * Supabase matches redirect URLs against an exact allowlist, so these are fixed
 * rather than ephemeral — each one must be registered in `supabase/config.toml`
 * locally and under Authentication > URL Configuration for hosted projects.
 * Three of them purely so a stale process holding one does not block sign-in.
 */
const LOOPBACK_PORTS = [53682, 53683, 53684]
const CALLBACK_PATH = '/callback'
const TIMEOUT_MS = 5 * 60 * 1000

/**
 * The PKCE verifier is written during `signInWithOAuth` and read back during
 * `exchangeCodeForSession`. Both happen in this one process, so it never needs
 * to touch disk — which also means an abandoned sign-in leaves nothing behind.
 */
function createMemoryStorage() {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

function respond(
  res: ServerResponse,
  status: number,
  heading: string,
  detail: string
): void {
  const body = `<!doctype html><meta charset="utf-8"><title>${heading}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;height:100vh;color:#111}
main{text-align:center;max-width:32rem;padding:2rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0;color:#555}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}p{color:#aaa}}</style>
<main><h1>${heading}</h1><p>${detail}</p></main>`

  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
  res.end(body)
}

type CallbackServer = {
  port: number
  code: Promise<string>
  close: () => void
}

/**
 * Bind the first available port. Anything other than "already in use" is a real
 * failure and rethrown rather than silently skipped.
 */
async function bind(server: Server): Promise<number> {
  for (const port of LOOPBACK_PORTS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error)

        server.once('error', onError)
        server.listen(port, '127.0.0.1', () => {
          server.off('error', onError)
          resolve()
        })
      })

      return port
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
        throw error
      }
    }
  }

  throw new ApiError(
    `Every loopback port is in use (${LOOPBACK_PORTS.join(', ')}). ` +
      'Close whatever is holding one and try again.',
    500
  )
}

async function startCallbackServer(): Promise<CallbackServer> {
  let settle: (code: string) => void = () => {}
  let fail: (error: Error) => void = () => {}

  const code = new Promise<string>((resolve, reject) => {
    settle = resolve
    fail = reject
  })

  const server = createServer((req, res) => {
    // Only the origin matters for parsing; the request never leaves this host.
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (url.pathname !== CALLBACK_PATH) {
      res.writeHead(404).end()

      return
    }

    const failure =
      url.searchParams.get('error_description') ?? url.searchParams.get('error')
    const received = url.searchParams.get('code')

    if (failure || !received) {
      const detail = failure ?? 'No authorization code was returned.'

      respond(res, 400, 'Sign-in failed', detail)
      fail(new ApiError(detail, 401))

      return
    }

    respond(
      res,
      200,
      'Signed in',
      'You can close this tab and return to your terminal.'
    )
    settle(received)
  })

  const port = await bind(server)

  return {
    port,
    code,
    close: () => server.close(),
  }
}

/**
 * Best-effort. The URL is always printed too, so a failure here (headless box,
 * SSH session, locked-down machine) degrades to copy-and-paste rather than a
 * dead end.
 */
function openBrowser(url: string): void {
  const isWindows = process.platform === 'win32'
  const command = isWindows
    ? 'cmd'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open'
  // The empty string is `start`'s title argument; without it a quoted URL is
  // taken as the window title and nothing opens.
  const args = isWindows ? ['/c', 'start', '', url] : [url]

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true })

    // spawn reports a missing binary asynchronously, so this cannot be caught
    // by the surrounding try.
    child.on('error', () => {})
    child.unref()
  } catch {
    // Handled by the printed URL.
  }
}

function withTimeout(code: Promise<string>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ApiError('Timed out waiting for the browser sign-in.', 408))
    }, TIMEOUT_MS)

    // Node keeps the process alive for a pending timer; this one should not
    // outlive the request it is guarding.
    timer.unref?.()

    code.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

export async function signInWithBrowser(
  apiUrl: string,
  announce: (url: string) => void
): Promise<StoredCredentials> {
  const meta = await fetchPortalMeta(apiUrl)
  const supabase = createClient(meta.supabaseUrl, meta.supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: createMemoryStorage(),
    },
  })

  const server = await startCallbackServer()

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `http://127.0.0.1:${server.port}${CALLBACK_PATH}`,
        skipBrowserRedirect: true,
      },
    })

    if (error || !data.url) {
      throw new ApiError(
        error?.message ?? 'Supabase did not return an authorization URL.',
        error?.status ?? 500
      )
    }

    announce(data.url)
    openBrowser(data.url)

    const code = await withTimeout(server.code)
    const exchanged = await supabase.auth.exchangeCodeForSession(code)

    if (exchanged.error || !exchanged.data.session) {
      throw new ApiError(
        exchanged.error?.message ?? 'The authorization code could not be used.',
        exchanged.error?.status ?? 401
      )
    }

    const { session } = exchanged.data
    const credentials: StoredCredentials = {
      email: session.user.email ?? 'unknown',
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    }

    await writeCredentials(apiUrl, credentials)

    return credentials
  } finally {
    server.close()
  }
}
