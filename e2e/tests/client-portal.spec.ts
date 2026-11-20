import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

/**
 * The client portal, read-only, as an admin previewing it.
 */

const portal = process.env.E2E_PORTAL_URL ?? 'http://localhost:3011'

test('client portal: the menu is labelled with a first name', async ({
  page,
}) => {
  await page.goto(`${portal}/`)
  await expectHealthy(page)
  const trigger = page.getByRole('button', { name: /, your menu$/ })
  await expect(trigger).toBeVisible()
  const label = (await trigger.innerText()).trim()
  expect(label).not.toBe('')
  expect(label).not.toBe('Profile')
  // One word: a first name (or the email's local part), never a full name.
  expect(label).not.toMatch(/\s/)
  await trigger.click()
  await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible()
})

test('client portal: a Net 30 client sees hours by month', async ({ page }) => {
  await page.goto(`${portal}/hours`)
  await expectHealthy(page)
  // Preview a person at a Net 30 client (Nina, Fieldnote, in the seed). This
  // changes only this browser's preview cookie, no data.
  await page
    .getByText('Admin preview', { exact: true })
    .locator('..')
    .getByRole('button')
    .first()
    .click()
  await page
    .getByRole('menuitem')
    .filter({ hasText: process.env.E2E_NET30_CONTACT ?? 'Nina Park' })
    .first()
    .click()
  await page.waitForLoadState('networkidle')
  await page.reload()
  await expect(
    page.getByText('Hours logged on your projects, by month.')
  ).toBeVisible()

  const main = page.getByRole('main')
  // This month's hours lead.
  await expect(
    main.getByText(/^logged in [A-Z][a-z]+ \d{4}$/).first()
  ).toBeVisible()
  // Earlier months, if any: one row each, hours as data, newest first.
  const lists = main.getByRole('list', { name: 'Earlier months' })
  for (const list of await lists.all()) {
    const months: number[] = []
    for (const row of await list.getByRole('listitem').all()) {
      const month = await row.locator('span').nth(0).innerText()
      const hours = await row.locator('span').nth(1).innerText()
      expect(hours.trim()).toMatch(/^[\d,.]+h$/)
      months.push(Date.parse(`1 ${month.trim()}`))
    }
    expect(months).toEqual([...months].sort((a, b) => b - a))
  }
})
