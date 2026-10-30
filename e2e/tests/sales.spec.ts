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

  // The name cell: the row's middle can be the company link.
  await page.locator('tbody tr').first().getByRole('cell').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByText('Only an admin can edit someone who can sign in.')
  ).toBeVisible()
  await expect(sheet.getByPlaceholder('John Doe')).toBeDisabled()
  await expect(sheet.getByPlaceholder('contact@example.com')).toBeDisabled()
  // No Sign-in section, role or portal access.
  await expect(sheet.getByText('Can sign in', { exact: true })).toHaveCount(0)
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

test('sales sees no portal switches on a client company’s people', async ({
  page,
}) => {
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
  await expect(
    sheet.getByRole('switch', { name: /^Portal access for / })
  ).toHaveCount(0)
  await expect(sheet.getByText('Portal', { exact: true })).toHaveCount(0)
})

// The rest of the Sales write rules (lead saves leaving people with a sign-in
// unedited, archiving/restoring them, moving them between companies) are
// server-side refusals the Sales UI never offers, so they aren't reachable
// from here.
test('sales can’t rename the staff company', async ({ page }) => {
  // A refused save writes nothing, but a regression would rename it.
  test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')
  const staffName = process.env.E2E_STAFF_COMPANY ?? 'Place To Stand'
  await page.goto(`/companies?q=${encodeURIComponent(staffName)}`)
  await expectHealthy(page)
  const row = page.locator('tbody tr').filter({ hasText: staffName }).first()
  test.skip((await row.count()) === 0, 'no staff company to open')
  await row.getByRole('cell', { name: staffName, exact: true }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Name').fill(`${staffName} (renamed)`)
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    page.getByText(`Only an admin can change ${staffName}.`)
  ).toBeVisible()
})
