import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

// Sales: the CRM plus projects they're a member of (projects.view_member).
test('sales sees the CRM and member projects only', async ({ page }) => {
  await page.goto('/leads')
  await expectHealthy(page)
  const nav = page.locator('[data-sidebar="menu-button"]')
  await expect(nav.filter({ hasText: 'Leads' })).toHaveCount(1)
  for (const hidden of ['Invoices', 'Hour blocks', 'Time logs', 'Monthly close', 'Design system', 'Integrations']) {
    await expect(nav.filter({ hasText: hidden })).toHaveCount(0)
  }
})

test('sales is sent back from admin pages', async ({ page }) => {
  for (const path of ['/invoices', '/hour-blocks', '/design', '/reports/monthly-close']) {
    await page.goto(path)
    await expect(page).not.toHaveURL(new RegExp(`${path}$`))
  }
})

test('sales sees no billing or sign-in controls on a company', async ({ page }) => {
  await page.goto('/companies')
  await page.locator('tbody tr').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('tab', { name: 'Billing' })).toHaveCount(0)
  await expect(sheet.getByText('Bill this company')).toHaveCount(0)
})

test('sales sees no portal switches on a client company’s people', async ({ page }) => {
  await page.goto('/companies')
  const clientRow = page
    .locator('tbody tr')
    .filter({ has: page.locator('[data-slot="badge"]', { hasText: 'Client' }) })
    .first()
  test.skip((await clientRow.count()) === 0, 'no client company to open')
  await clientRow.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('tab', { name: 'People' }).click()
  await expect(sheet.getByRole('switch', { name: /^Portal access for / })).toHaveCount(0)
  await expect(sheet.getByText('Portal', { exact: true })).toHaveCount(0)
})
