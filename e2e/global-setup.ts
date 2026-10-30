import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { chromium, type FullConfig } from '@playwright/test'

/**
 * Signs in the local test users with one-time recovery links from the LOCAL
 * Supabase and saves each session. Refuses anything but a local Supabase.
 */
const ACCOUNTS = {
  admin: process.env.E2E_ADMIN_EMAIL ?? 'jason@local.test',
  sales: process.env.E2E_SALES_EMAIL ?? 'dave@local.test',
}

function localEnv() {
  const file = path.join(__dirname, '../apps/internal/.env.local')
  const env: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '')
  }
  const url = process.env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Local Supabase URL and service key not found')
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`E2E sign-in only runs against a local Supabase (got ${host})`)
  }
  return { url, key }
}

async function signInLink(email: string) {
  const { url, key } = localEnv()
  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const body = (await response.json()) as { hashed_token?: string; properties?: { hashed_token?: string } }
  const token = body.properties?.hashed_token ?? body.hashed_token
  if (!response.ok || !token) throw new Error(`No sign-in link for ${email}: ${response.status}`)
  return token
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:3003'
  const host = new URL(baseURL).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`E2E only runs against a local app (got ${host})`)
  }
  mkdirSync(path.join(__dirname, '.auth'), { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome' })
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const token = await signInLink(email)
    const params = new URLSearchParams({ token_hash: token, type: 'recovery', redirect_to: role === 'admin' ? '/my/home' : '/leads' })
    await page.goto(`${baseURL}/auth/confirm?${params}`)
    await page.waitForURL(url => !url.pathname.startsWith('/auth') && !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
    await context.storageState({ path: path.join(__dirname, `.auth/${role}.json`) })
    await context.close()
  }
  await browser.close()
}
