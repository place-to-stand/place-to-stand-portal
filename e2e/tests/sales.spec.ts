import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

// Sales: the CRM plus projects they're a member of (projects.view_member).
test('sales sees the CRM and member projects only', async ({ page }) => {
  await page.goto('/leads')
  await expectHealthy(page)
  const nav = page.locator('[data-sidebar="menu-button"]')
  await expect(nav.filter({ hasText: 'Leads' })).toHaveCount(1)
  for (const hidden of [
    'Invoices',
    'Hour blocks',
    'Time logs',
    'Monthly close',
    'Design system',
    'Integrations',
  ]) {
    await expect(nav.filter({ hasText: hidden })).toHaveCount(0)
  }
})

test('sales is sent back from admin pages', async ({ page }) => {
  for (const path of [
    '/invoices',
    '/hour-blocks',
    '/design',
    '/reports/monthly-close',
  ]) {
    await page.goto(path)
    await expect(page).not.toHaveURL(new RegExp(`${path}$`))
  }
})

test('sales sees a person with a sign-in read-only, without sign-in or portal fields', async ({
  page,
}) => {
  // The admin test account has a sign-in.
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'jason@local.test'
  await page.goto(`/people?q=${encodeURIComponent(adminEmail)}`)
  await expectHealthy(page)
  // No sign-in or portal access columns for Sales.
  await expect(page.getByRole('columnheader', { name: 'Sign-in' })).toHaveCount(
    0
  )
  await expect(
    page.getByRole('columnheader', { name: 'Portal access' })
  ).toHaveCount(0)

  await page.locator('tbody tr').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByText('Only an admin can edit someone who can sign in.')
  ).toBeVisible()
  await expect(sheet.getByPlaceholder('John Doe')).toBeDisabled()
  await expect(sheet.getByPlaceholder('contact@example.com')).toBeDisabled()
  // No Sign-in section, role or portal access.
  await expect(sheet.getByText('Can sign in')).toHaveCount(0)
  await expect(sheet.getByText('Role', { exact: true })).toHaveCount(0)
  await expect(sheet.getByText('Portal access')).toHaveCount(0)
  await expect(
    sheet.getByRole('button', { name: 'Save changes' })
  ).toBeDisabled()
})

test('sales sees no billing or sign-in controls on a company', async ({
  page,
}) => {
  await page.goto('/companies')
  await page.locator('tbody tr').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('tab', { name: 'Billing' })).toHaveCount(0)
  await expect(sheet.getByText('Bill this company')).toHaveCount(0)
})
