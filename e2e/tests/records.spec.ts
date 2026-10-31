import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

test('company sheet: two columns, no tabs, Billing reachable by deep link', async ({
  page,
}) => {
  await page.goto('/companies?type=client')
  await page.locator('tbody tr').first().locator('td').first().click()
  const sheet = page.getByRole('dialog')
  // Company on the left, Client on the right: no tabs.
  await expect(sheet.getByRole('tab')).toHaveCount(0)
  await expect(
    sheet.getByRole('heading', { name: 'People', exact: true })
  ).toBeVisible()
  await expect(
    sheet.getByRole('heading', { name: 'Client', exact: true })
  ).toBeVisible()
  await expect(sheet.getByText('Bill this company')).toBeVisible()
  // An old `tab=billing` link still opens the sheet (the param is ignored).
  await page.goto(`${page.url()}&tab=billing`)
  await expect(
    page.getByRole('dialog').getByText('Bill this company')
  ).toBeVisible()
})

test('a client company shows the Client badge and its projects', async ({
  page,
}) => {
  await page.goto('/companies?type=client')
  await expectHealthy(page)
  const row = page.locator('tbody tr').first()
  await expect(
    row.locator('[data-slot="badge"]', { hasText: 'Client' })
  ).toBeVisible()
  await row.locator('td').first().click()
  const sheet = page.getByRole('dialog')
  await expect(
    sheet.getByRole('heading', { name: 'Projects', exact: true })
  ).toBeVisible()
})

test('person sheet is one stacked form, access included', async ({ page }) => {
  await page.goto('/people')
  await page.locator('tbody tr').first().locator('td').first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('tab')).toHaveCount(0)
  await expect(sheet.getByRole('radiogroup', { name: 'Access' })).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: /^Save changes/ })
  ).toHaveCount(1)
})

test('projects list: client rows open the company', async ({ page }) => {
  await page.goto('/projects')
  const link = page.locator('tbody a[href*="company="]').first()
  await expect(link).toHaveAttribute(
    'href',
    /\/companies\?company=[0-9a-f-]{36}$/
  )
  await link.click()
  const sheet = page.getByRole('dialog')
  await expect(
    sheet.getByRole('heading', { name: 'Projects', exact: true })
  ).toBeVisible()
  await expect(page.locator('#company-projects')).toBeInViewport()
})

test('lead sheet opens with the person and company pickers', async ({
  page,
}) => {
  await page.goto('/leads/archive')
  await expectHealthy(page)
  await page.goto('/leads?lead=new')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByText('Company', { exact: true }).first()
  ).toBeVisible()
})

test('September 2026 close matches the production copy', async ({ page }) => {
  test.skip(!process.env.E2E_PROD_COPY, 'only on a production copy')
  await page.goto('/reports/monthly-close?year=2026&month=9')
  await expect(page.locator('body')).toContainText('$5,200.00')
  await expect(page.locator('body')).toContainText('$4,462.50')
})

test('client portal: admin preview shows a client’s dashboard', async ({
  page,
}) => {
  const portal = process.env.E2E_PORTAL_URL ?? 'http://localhost:3011'
  await page.goto(`${portal}/`)
  await expect(page.locator('body')).toContainText('Dashboard')
  // Pick someone to preview as, if no one is picked yet.
  if (
    await page
      .getByRole('main')
      .getByText('Choose a person above to see the portal')
      .isVisible()
  ) {
    await page
      .getByRole('button', { name: 'Choose a person to preview' })
      .click()
    await page.getByRole('menuitem').first().click()
  }
  await expect(page.locator('body')).toContainText('Hours')
  await expectHealthy(page)
})
