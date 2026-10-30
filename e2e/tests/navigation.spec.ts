import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

test('admin sidebar: Settings starts with Integrations and ends with Design system', async ({ page }) => {
  await page.goto('/my/home')
  const settings = page.locator('[data-sidebar="group"]').filter({ hasText: 'Settings' })
  const items = settings.locator('[data-sidebar="menu-button"]')
  await expect(items.first()).toContainText('Integrations')
  await expect(items.last()).toContainText('Design system')
})

test('the Design system item is active on /design', async ({ page }) => {
  await page.goto('/design')
  const item = page.locator('[data-sidebar="menu-button"]', { hasText: 'Design system' })
  await expect(item).toHaveAttribute('data-active', 'true')
})

test('hour blocks and time logs have different sidebar icons', async ({ page }) => {
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
  await expect(page).toHaveURL(/\/people/)
  await page.goto('/clients')
  await expect(page).toHaveURL(/\/companies/)
  await expectHealthy(page)
})
