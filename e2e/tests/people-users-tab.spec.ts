import { expect, test } from '@playwright/test'

// People → Users lists people who can sign in; Reset keeps the tab.
// Read-only.
test('the Users tab keeps its tab on reset', async ({ page }) => {
  await page.goto('/people')
  await page.getByRole('tab', { name: 'Users', exact: true }).click()
  await expect(page).toHaveURL(/role=any/)

  // The tab alone is not a filter: no Reset yet.
  await expect(page.getByRole('button', { name: /reset/i })).toHaveCount(0)

  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()

  // Narrowing by company then resetting stays on Users.
  await page.getByRole('combobox', { name: 'All companies' }).click()
  await page.getByRole('option').first().click()
  await page.getByRole('button', { name: /reset/i }).click()
  await expect(page).toHaveURL(/role=any/)
  await expect(page).not.toHaveURL(/companyId=/)
})
