import { expect, test } from '@playwright/test'

import { expectHealthy } from './helpers'

// Every list column sorts: each header but the select box and Actions is a
// sort button. Clicking one marks it ascending, a second click descending,
// and the list renders either way. Read-only.
const LISTS = [
  '/companies',
  '/companies/clients',
  '/companies/archive',
  '/people',
  '/people/users',
  '/people/archive',
  '/projects',
  '/projects/archive',
  '/hour-blocks',
  '/invoices',
  '/invoices/archive',
  '/invoices/settings',
  '/submissions',
  '/submissions/archive',
  '/time-logs',
  '/time-logs/archive',
  '/leads/archive',
]

for (const path of LISTS) {
  test(`every column sorts on ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const tables = page.locator('table:has(thead)')
    const tableCount = await tables.count()
    for (let t = 0; t < tableCount; t++) {
      const heads = tables.nth(t).locator('thead th')
      const headCount = await heads.count()
      for (let i = 0; i < headCount; i++) {
        const head = heads.nth(i)
        const text = (await head.innerText()).trim()
        // The select box (no text) and Actions don't sort.
        if (!text || text === 'Actions') continue
        await expect(
          head.getByRole('button'),
          `${path}: "${text}" sorts`
        ).toHaveCount(1)
      }
    }
    // Click through the first table's columns: asc, then desc.
    const heads = tables.first().locator('thead th:has(button)')
    const count = await heads.count()
    for (let i = 0; i < count; i++) {
      const head = tables.first().locator('thead th:has(button)').nth(i)
      const sorted = await head.getAttribute('aria-sort')
      await head.getByRole('button').click()
      await expect(head).toHaveAttribute(
        'aria-sort',
        sorted === 'ascending' ? 'descending' : 'ascending'
      )
      await expectHealthy(page)
      await head.getByRole('button').click()
      await expectHealthy(page)
    }
  })
}
