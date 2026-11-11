import { expect, test } from '@playwright/test'

// Clients are their own page under Companies, so the type filter only
// offers "Not a client", and the Clients page hides it. Read-only.
test('the company type filter offers only not a client', async ({ page }) => {
  await page.goto('/companies')
  await page.getByRole('combobox', { name: 'All companies' }).click()
  const options = page.getByRole('option')
  await expect(options).toHaveText(['Not a client'])

  // Plain text options: no badge.
  await expect(
    page.getByRole('option').locator('[data-slot=badge]')
  ).toHaveCount(0)

  // Not a client: no row carries a billing badge (Prepaid / Net 30).
  await page.getByRole('option', { name: 'Not a client' }).click()
  await expect(page).toHaveURL(/type=none/)
  const rows = page.locator('tbody tr')
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
