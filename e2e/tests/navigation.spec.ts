import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

test('admin sidebar: Admin holds Settings and one Reference item', async ({
  page,
}) => {
  await page.goto('/my/home')
  const admin = page
    .locator('[data-sidebar="group"]')
    .filter({ hasText: 'Admin' })
  await expect(admin.locator('[data-sidebar="menu-button"]')).toHaveText([
    'Settings',
    'Reference',
  ])
})

test('Reference is one tabbed page; /reference lands on its first tab', async ({
  page,
}) => {
  await page.goto('/reference')
  await expect(page).toHaveURL(/\/reference\/health$/)
  for (const tab of [
    'System health',
    'Roles & permissions',
    'Notifications',
    'Emails',
    'PDFs',
    'Chat messages',
    'Design system',
  ]) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible()
  }
  const item = page.locator('[data-sidebar="menu-button"]', {
    hasText: 'Reference',
  })
  await page.getByRole('tab', { name: 'Notifications' }).click()
  await expect(page).toHaveURL(/\/reference\/notifications$/)
  await expect(item).toHaveAttribute('data-active', 'true')
  await expectHealthy(page)
})

test('Settings is one tabbed page; /settings lands on Business', async ({
  page,
}) => {
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/settings\/business$/)
  for (const tab of ['Business', 'Billing', 'Integrations']) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible()
  }
  const item = page.locator('[data-sidebar="menu-button"]', {
    hasText: 'Settings',
  })
  await page.getByRole('tab', { name: 'Billing' }).click()
  await expect(page).toHaveURL(/\/settings\/billing$/)
  await expect(item).toHaveAttribute('data-active', 'true')
})

test('Get help opens from the user menu', async ({ page }) => {
  await page.goto('/my/home')
  await page
    .locator('[data-sidebar="footer"]')
    .getByRole('button')
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Get help' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: 'Book a call' })).toBeVisible()
})

test('template kinds are Reference tabs; old links still land', async ({
  page,
}) => {
  await page.goto('/reference/templates/emails')
  await page.getByRole('tab', { name: 'PDFs' }).click()
  await expect(page).toHaveURL(/\/reference\/templates\/pdfs$/)
  await expect(page.getByRole('tab', { name: 'PDFs' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await page.goto('/reference/templates/notifications')
  await expect(page).toHaveURL(/\/reference\/templates\/chat$/)
})

test('hour blocks and time logs have different sidebar icons', async ({
  page,
}) => {
  await page.goto('/my/home')
  const icon = async (label: string) =>
    page
      .locator('[data-sidebar="menu-button"]', { hasText: label })
      .locator('svg')
      .first()
      .getAttribute('class')
  expect(await icon('Hour blocks')).toContain('lucide-hourglass')
  expect(await icon('Time logs')).toContain('lucide-clock')
})

test('old bookmarks still land on the right page', async ({ page }) => {
  await page.goto('/contacts')
  await expect(page).toHaveURL(/\/people/)
  await page.goto('/settings/users')
  await expect(page).toHaveURL(/\/people\/users/)
  await page.goto('/clients')
  await expect(page).toHaveURL(/\/companies\/clients/)
  // Users was once a list preset; Companies filters to clients in place.
  await page.goto('/companies?type=client')
  await expect(page).toHaveURL(/\/companies\?type=client$/)
  await page.goto('/people?role=ADMIN')
  await expect(page).toHaveURL(/\/people\/users\?role=ADMIN$/)
  await page.goto('/clients/archive')
  await expect(page).toHaveURL(/\/companies\?type=former/)
  await page.goto('/reports')
  await expect(page).toHaveURL(/\/reports\/monthly-close/)
  await page.goto('/my/tasks')
  await expect(page).toHaveURL(/\/my\/tasks\/board/)
  await expectHealthy(page)
})

test('old ?client= sheet links open the company sheet', async ({ page }) => {
  const id = '00000000-0000-4000-8000-000000000000'
  await page.goto(`/companies?client=${id}&task=new`)
  // Renamed in place, so the stack order (company under task) is kept.
  await expect(page).toHaveURL(new RegExp(`\\?company=${id}&task=new$`))
})

test('the user menu opens the Account sheet; Settings → Integrations is company only', async ({
  page,
}) => {
  await page.goto('/my/home')
  await page.locator('[data-sidebar="footer"] button').first().click()
  await page.getByRole('menuitem', { name: 'Account' }).click()
  await expect(page).toHaveURL(/[?&]account=profile/)
  const sheet = page.getByRole('dialog', { name: 'Account' })
  // The profile comes first, under the sheet's own title; then two sections.
  await expect(sheet.getByLabel('Full name')).toBeVisible()
  for (const heading of ['Integrations', 'Preferences']) {
    await expect(sheet.getByRole('heading', { name: heading })).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/account=/)

  await page.goto('/settings/integrations')
  await expect(page.getByText('Mercury').first()).toBeVisible()
  await expect(page.getByText('Connected apps')).toHaveCount(0)
})
