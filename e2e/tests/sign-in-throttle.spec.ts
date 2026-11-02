import { expect, test, type Page } from '@playwright/test'

/**
 * Password sign-in is throttled app-side: 10 attempts per email (and 30 per
 * IP) in 15 minutes. Each attempt writes a rate_limit_buckets row, so this
 * runs only with E2E_WRITES=1 on a throwaway database. A made-up address is
 * used each run, so no real account is ever locked.
 *
 * The per-IP bucket is shared across runs from one machine: run this more
 * than twice inside 15 minutes and the IP limit trips first — the message
 * is the same either way.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

test.use({ storageState: { cookies: [], origins: [] } })

const PER_EMAIL_LIMIT = 10
const THROTTLED = 'Too many attempts to sign in. Try again in a few minutes.'
const PORTAL_URL = process.env.E2E_PORTAL_URL ?? 'http://localhost:3011'

function madeUpEmail() {
  return `throttle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

async function attempt(page: Page, email: string) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  const submitted = page.getByRole('button', { name: 'Sign in', exact: true })
  await expect(submitted).toBeEnabled()
  await submitted.click()
  await expect(submitted).toBeEnabled()
}

test('internal portal: wrong password N+1 times is throttled', async ({
  page,
}) => {
  const email = madeUpEmail()
  await page.goto('/sign-in')

  for (let i = 0; i < PER_EMAIL_LIMIT; i++) {
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST'),
      attempt(page, email),
    ])
    await expect(page.getByText(THROTTLED)).toHaveCount(0)
  }

  await attempt(page, email)
  await expect(page.getByText(THROTTLED)).toBeVisible()
})

test('client portal: wrong password N+1 times is throttled', async ({
  page,
}) => {
  const email = madeUpEmail()
  await page.goto(`${PORTAL_URL}/sign-in`)

  for (let i = 0; i < PER_EMAIL_LIMIT; i++) {
    // Allowed attempts reach Supabase from the browser.
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/auth/v1/token')),
      attempt(page, email),
    ])
    await expect(page.getByText(THROTTLED)).toHaveCount(0)
  }

  await attempt(page, email)
  await expect(page.getByText(THROTTLED)).toBeVisible()
})
