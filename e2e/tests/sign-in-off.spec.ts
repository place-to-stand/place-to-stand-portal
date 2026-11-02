import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Turning off "Can sign in" really locks someone out, everywhere, and
 * turning it back on lets them in again. For a new Admin and a new Sales
 * person: their open session stops working on the next page load, API call
 * and CLI request (bearer token); a fresh sign-in link doesn't get them in;
 * switching back on does. (Client sign-ins can't use this app at all; the
 * client portal's view drops a switched-off sign-in, checked by
 * scripts/check-portal-role.mjs.) Writes: E2E_WRITES only, local only.
 */

test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

function localSupabase() {
  const file = path.join(__dirname, '../../apps/internal/.env.local')
  const env: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '')
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Local Supabase only')
  }
  return { url, key }
}

/** A one-time sign-in link's token, or null when Supabase refuses one. */
async function signInToken(email: string): Promise<string | null> {
  const { url, key } = localSupabase()
  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  if (!response.ok) return null
  const body = (await response.json()) as {
    hashed_token?: string
    properties?: { hashed_token?: string }
  }
  return body.properties?.hashed_token ?? body.hashed_token ?? null
}

/** As if they had set their password: clears the first-sign-in reset. */
async function skipFirstPasswordReset(email: string) {
  const { url, key } = localSupabase()
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
  const link = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const body = (await link.json()) as { id?: string; user?: { id?: string } }
  const id = body.id ?? body.user?.id
  if (!id) throw new Error('No auth user for the new sign-in')
  const update = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ user_metadata: { must_reset_password: false } }),
  })
  if (!update.ok) throw new Error(`Could not clear the reset: ${update.status}`)
}

/** Signs in through the link; returns where it landed. */
async function signIn(browser: Browser, email: string, home: string) {
  // Empty: not the project's stored admin sign-in.
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  const token = await signInToken(email)
  if (token) {
    const params = new URLSearchParams({
      token_hash: token,
      type: 'recovery',
      redirect_to: home,
    })
    await page.goto(`/auth/confirm?${params}`)
    await page.waitForLoadState('networkidle')
  }
  return { context, page, linkIssued: Boolean(token) }
}

/** The session's access token (the CLI's bearer) from the auth cookie. */
async function accessToken(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies()
  const parts = cookies
    .filter(cookie => /^sb-.*-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(cookie => cookie.value)
  if (!parts.length) return null
  let raw = parts.join('')
  if (raw.startsWith('base64-')) {
    raw = Buffer.from(raw.slice('base64-'.length), 'base64').toString('utf8')
  }
  try {
    return (JSON.parse(raw) as { access_token?: string }).access_token ?? null
  } catch {
    return null
  }
}

async function setCanSignIn(page: Page, email: string, on: boolean) {
  await page.goto(`/people?q=${encodeURIComponent(email)}`)
  await page.locator('tbody tr').first().locator('td').first().click()
  const sheet = page.getByRole('dialog')
  const toggle = sheet.getByRole('switch', { name: 'Can sign in' })
  // Locked while their sign-in loads: wait until it can be used.
  await expect(toggle).toBeEnabled()
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) {
    await toggle.click()
  }
  await expect(toggle).toHaveAttribute('aria-checked', String(on))
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(sheet).toBeHidden()
}

for (const [role, home] of [
  ['Admin', '/my/home'],
  ['Sales', '/leads'],
] as const) {
  test(`switching off a ${role} sign-in locks them out everywhere; on again lets them in`, async ({
    page,
    browser,
  }) => {
    const stamp = Date.now()
    const name = `E2E ${role} lockout ${stamp}`
    const email = `e2e-lockout-${role.toLowerCase()}-${stamp}@local.test`

    // A new person who can sign in with this role.
    await page.goto('/people?contact=new')
    const sheet = page.getByRole('dialog')
    await sheet.getByPlaceholder('John Doe').fill(name)
    await sheet.getByPlaceholder('contact@example.com').fill(email)
    await sheet.getByRole('switch', { name: 'Can sign in' }).click()
    await sheet.getByRole('combobox', { name: 'Role', exact: true }).click()
    await page.getByRole('option', { name: role }).click()
    await sheet.getByRole('button', { name: 'Create person' }).click()
    await expect(sheet).toBeHidden()

    // They sign in (past the first-sign-in password step), and their
    // session works: a page, an API, the CLI.
    await skipFirstPasswordReset(email)
    const user = await signIn(browser, email, home)
    expect(user.linkIssued).toBe(true)
    await expect(user.page).toHaveURL(new RegExp(home))
    const bearer = await accessToken(user.page)
    expect(bearer).toBeTruthy()
    const cli = await user.page.request.get('/api/cli/v1/whoami', {
      headers: { Authorization: `Bearer ${bearer}` },
    })
    // The CLI is for admins; Sales are refused it either way.
    expect(cli.status()).toBe(role === 'Admin' ? 200 : 403)

    // An admin switches their sign-in off.
    await setCanSignIn(page, email, false)

    // The open session: the next page load signs them out...
    await user.page.goto(home)
    await expect(user.page).toHaveURL(/\/sign-in|\/unauthorized/)
    // ...an API call is refused...
    const api = await user.page.request.get('/api/sheets/init?lead=new', {
      maxRedirects: 0,
    })
    expect([401, 403, 307, 302]).toContain(api.status())
    // ...and so is their CLI token.
    const cliAfter = await user.page.request.get('/api/cli/v1/whoami', {
      headers: { Authorization: `Bearer ${bearer}` },
    })
    expect(cliAfter.status()).toBe(401)
    await user.context.close()

    // A fresh sign-in link doesn't get them in.
    const again = await signIn(browser, email, home)
    // (Supabase issues the link but refuses it: the sign-in is banned.)
    await again.page.goto(home)
    await expect(again.page).toHaveURL(/\/sign-in|\/unauthorized/)
    await again.context.close()

    // Switched back on: they can sign in again.
    await setCanSignIn(page, email, true)
    const back = await signIn(browser, email, home)
    expect(back.linkIssued).toBe(true)
    await expect(back.page).toHaveURL(new RegExp(home))
    await back.context.close()

    // Put it back: archive the person (their sign-in goes off with them).
    await page.goto(`/people?q=${encodeURIComponent(email)}`)
    await page.locator('tbody tr').first().locator('td').first().click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Archive person' })
      .click()
    await page
      .getByRole('button', { name: /^Archive/ })
      .last()
      .click()
  })
}
