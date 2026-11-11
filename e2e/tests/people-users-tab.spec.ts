import { expect, test } from '@playwright/test'

// People → Users lists people who can sign in, on its own page. Read-only.
test('the Users page lists sign-ins and keeps its page on reset', async ({
  page,
}) => {
  await page.goto('/people')
  await page.getByRole('tab', { name: 'Users', exact: true }).click()
  await expect(page).toHaveURL(/\/people\/users$/)

  // The page alone is not a filter: no Reset yet.
  await expect(page.getByRole('button', { name: /reset/i })).toHaveCount(0)

  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()

  // The Role filter offers roles only: no "No sign-in".
  await page.getByRole('combobox', { name: 'All roles' }).click()
  await expect(page.getByRole('option')).toHaveText([
    'Admin',
    'Client',
    'Sales',
  ])
  await page.keyboard.press('Escape')

  // Narrowing by company then resetting stays on Users.
  await page.getByRole('combobox', { name: 'All companies' }).click()
  await page.getByRole('option').first().click()
  await expect(page).toHaveURL(/companyId=/)
  await page.getByRole('button', { name: /reset/i }).click()
  await expect(page).toHaveURL(/\/people\/users$/)
})
