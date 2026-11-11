import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

test('admin sidebar: Settings starts with Integrations and ends with Design system', async ({
  page,
}) => {
  await page.goto('/my/home')
  const settings = page
    .locator('[data-sidebar="group"]')
    .filter({ hasText: 'Settings' })
  const items = settings.locator('[data-sidebar="menu-button"]')
  await expect(items.first()).toContainText('Integrations')
  await expect(items.last()).toContainText('Design system')
})

test('the Design system item is active on /design', async ({ page }) => {
  await page.goto('/design')
  const item = page.locator('[data-sidebar="menu-button"]', {
    hasText: 'Design system',
  })
  await expect(item).toHaveAttribute('data-active', 'true')
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
