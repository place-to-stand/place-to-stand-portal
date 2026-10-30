import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

/**
 * The client portal, read-only, as an admin previewing it.
 */

const portal = process.env.E2E_PORTAL_URL ?? 'http://localhost:3011'

test('client portal: the account menu is labelled with a first name', async ({
  page,
}) => {
  await page.goto(`${portal}/`)
  await expectHealthy(page)
  const trigger = page.getByRole('button', { name: /, account menu$/ })
  await expect(trigger).toBeVisible()
  const label = (await trigger.innerText()).trim()
  expect(label).not.toBe('')
  expect(label).not.toBe('Profile')
  // One word: a first name (or the email's local part), never a full name.
  expect(label).not.toMatch(/\s/)
  await trigger.click()
  await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible()
})
