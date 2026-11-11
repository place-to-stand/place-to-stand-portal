import { expect, test } from '@playwright/test'

// The type filter offers Client and Not a client (Clients is also its own
// page), and the Clients page hides it. Read-only.
test('the company type filter offers client and not a client', async ({
  page,
}) => {
  await page.goto('/companies')
  await page.getByRole('combobox', { name: 'All companies' }).click()
  const options = page.getByRole('option')
  await expect(options).toHaveText(['Client', 'Not a client'])

  // Both options are plain text, with no badge.
  await expect(
    page.getByRole('option').locator('[data-slot=badge]')
  ).toHaveCount(0)

  // Client: every row carries the Client badge, and the page stays put.
  await page.getByRole('option', { name: 'Client', exact: true }).click()
  await expect(page).toHaveURL(/\/companies\?type=client$/)
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  const count = await rows.count()
  for (let i = 0; i < count; i++) {
    await expect(
      rows.nth(i).locator('[data-slot=badge]', { hasText: /^Client$/ })
    ).toHaveCount(1)
  }

  // Not a client: no row carries a billing badge (Prepaid / Net 30).
  await page.getByRole('combobox', { name: 'All companies' }).click()
  await page.getByRole('option', { name: 'Not a client' }).click()
  await expect(page).toHaveURL(/type=none/)
  await expect(rows.first()).toBeVisible()
  await expect(
    page.locator('tbody [data-slot=badge]', { hasText: /Prepaid|Net 30/ })
  ).toHaveCount(0)
})

test('the Clients page lists clients and keeps its page on reset', async ({
  page,
}) => {
  await page.goto('/companies')
  await page.getByRole('tab', { name: 'Clients', exact: true }).click()
  await expect(page).toHaveURL(/\/companies\/clients$/)

  // The tab is the filter: no type menu, and every row is a client.
  await expect(
    page.getByRole('combobox', { name: 'All companies' })
  ).toHaveCount(0)
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  const count = await rows.count()
  for (let i = 0; i < count; i++) {
    await expect(
      rows.nth(i).locator('[data-slot=badge]', { hasText: 'Client' })
    ).toHaveCount(1)
  }

  // Narrowing then resetting stays on Clients.
  await page.getByRole('combobox', { name: 'Leads: any' }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('button', { name: /reset/i }).click()
  await expect(page).toHaveURL(/\/companies\/clients$/)
  await expect(page).not.toHaveURL(/leads=/)
})
