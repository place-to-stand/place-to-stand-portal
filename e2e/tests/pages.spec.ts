import { expect, test } from '@playwright/test'

import { LIST_PAGES, REDIRECT_ONLY, expectHealthy, inAppHrefs, rowHeights, waitForList } from './helpers'

for (const path of LIST_PAGES) {
  test.describe(path, () => {
    test('loads without an error', async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await waitForList(page)
      await expectHealthy(page)
    })

    test('links go straight to their page (no redirect-only routes)', async ({ page }) => {
      await page.goto(path)
      await waitForList(page)
      const bad = (await inAppHrefs(page)).filter(href => REDIRECT_ONLY.some(re => re.test(href)))
      expect(bad).toEqual([])
    })

    test('every row is the same height', async ({ page }) => {
      await page.goto(path)
      await waitForList(page)
      const rows = await rowHeights(page)
      test.skip(rows.length < 2, 'not enough rows')
      // The last row has no bottom border.
      const heights = new Set(rows.filter(row => !row.last).map(row => row.height))
      expect([...heights]).toHaveLength(1)
      const [height] = heights
      for (const row of rows.filter(row => row.last)) {
        expect(Math.abs(row.height - height)).toBeLessThanOrEqual(1)
      }
    })
  })
}

test('the design system page renders every entity with passing contrast', async ({ page }) => {
  await page.goto('/design#entities')
  await expectHealthy(page)
  const section = page.locator('#entities')
  // One row per registry entity (13), each with a light and a dark contrast badge.
  const badges = section.locator('[title^="Icon on card"]')
  await expect(badges).toHaveCount(26)
  await expect(badges.filter({ hasText: 'fails' })).toHaveCount(0)
  await expect(section.getByText('Time log').first()).toBeVisible()
  await expect(section.getByText(/^Hourglass/).first()).toBeVisible()
})

test('the design system page shows the Alert variants', async ({ page }) => {
  await page.goto('/design#feedback')
  await expect(page.locator('#feedback [data-slot="alert"]')).toHaveCount(3)
  await expect(page.locator('#feedback [data-slot="alert-action"] button').first()).toBeVisible()
})
