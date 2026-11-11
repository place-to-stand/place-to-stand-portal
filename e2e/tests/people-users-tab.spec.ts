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

// People narrows to people who can (or can't) sign in, as Companies
// narrows to clients. Users and Archive take no type. Read-only.
test('the People type filter offers user and not a user', async ({ page }) => {
  await page.goto('/people')
  await page.getByRole('combobox', { name: 'All people' }).click()
  await expect(page.getByRole('option')).toHaveText(['User', 'Not a user'])

  // User, then Not a user: each lands in the link.
  await page.getByRole('option', { name: 'User', exact: true }).click()
  await expect(page).toHaveURL(/\/people\?type=user$/)
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await page.getByRole('combobox', { name: 'All people' }).click()
  await page.getByRole('option', { name: 'Not a user' }).click()
  await expect(page).toHaveURL(/type=none/)

  // The Users page lists sign-ins only, so it has no type filter and drops
  // a type from its link.
  await page.goto('/people/users?type=none')
  await expect(page).toHaveURL(/\/people\/users$/)
  await expect(page.getByRole('combobox', { name: 'All people' })).toHaveCount(
    0
  )
  await page.goto('/people/archive?type=user')
  await expect(page).toHaveURL(/\/people\/archive$/)
  await expect(page.getByRole('combobox', { name: 'All people' })).toHaveCount(
    0
  )
})
