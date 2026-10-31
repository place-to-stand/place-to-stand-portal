import { expect, test } from '@playwright/test'

// The Companies list's type filter: Client and Not a client, plain text.
// Read-only.
test('the company type filter offers client and not a client', async ({
  page,
}) => {
  await page.goto('/companies')
  await page.getByRole('combobox', { name: 'All companies' }).click()
  const options = page.getByRole('option')
  await expect(options).toHaveText(['Client', 'Not a client'])

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
