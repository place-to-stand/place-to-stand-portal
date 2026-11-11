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
    expect(tableCount, `${path} shows a table`).toBeGreaterThan(0)
    for (let t = 0; t < tableCount; t++) {
      const heads = tables.nth(t).locator('thead th')
      const headCount = await heads.count()
      for (let i = 0; i < headCount; i++) {
        const head = heads.nth(i)
        const text = (await head.innerText()).trim()
        // The select box (no text) and Actions don't sort.
        if (!text || text === 'Actions') continue
        // Counted in the DOM: a column can be hidden at this width.
        await expect(
          head.locator('button'),
          `${path}: "${text}" sorts`
        ).toHaveCount(1)
      }
    }
    // Click through the first table's visible columns, asc then desc, and
    // wait for the server each time: a bad ORDER BY shows the error page.
    const firstTable = tables.first()
    const visibleHeads = firstTable.locator('thead th:visible:has(button)')
    const count = await visibleHeads.count()
    expect(count, `${path} has sortable columns`).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const head = visibleHeads.nth(i)
      const sorted = await head.getAttribute('aria-sort')
      for (const expected of [
        sorted === 'ascending' ? 'descending' : 'ascending',
        null,
      ]) {
        await head.getByRole('button').click()
        await page.waitForLoadState('networkidle')
        if (expected) await expect(head).toHaveAttribute('aria-sort', expected)
        await expect(firstTable).toBeVisible()
        await expect(page.getByText('This page hit an error.')).toHaveCount(0)
        await expectHealthy(page)
      }
    }
  })
}
