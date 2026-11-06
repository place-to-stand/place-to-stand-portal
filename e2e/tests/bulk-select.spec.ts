import { expect, test } from '@playwright/test'

import { expectHealthy, waitForList } from './helpers'

// Bulk select on every list with an Archive or Restore row action: the box
// hides until hover, ticking shows the bar, the header ticks the page.
// Read-only: nothing is archived.
const BULK_LISTS = [
  '/companies',
  '/companies/archive',
  '/people',
  '/people/archive',
  '/projects',
  '/projects/archive',
  '/time-logs',
  '/time-logs/archive',
  '/hour-blocks',
  '/hour-blocks/archive',
  '/invoices',
  '/invoices/archive',
  '/submissions',
  '/submissions/archive',
]

for (const path of BULK_LISTS) {
  test(`bulk select on ${path}`, async ({ page }) => {
    await page.goto(path)
    await waitForList(page)
    await expectHealthy(page)

    const cells = page.locator('td[data-slot=table-select-cell]')
    if ((await cells.count()) === 0) test.skip(true, 'No rows to select')

    const firstRow = page
      .locator('tbody tr:has(td[data-slot=table-select-cell])')
      .first()
    const box = firstRow.getByRole('checkbox')
    await expect(box).toHaveCSS('opacity', '0')
    await firstRow.hover()
    await expect(box).toHaveCSS('opacity', '1')

    // A click in the select cell ticks the row and never opens it.
    const url = page.url()
    await firstRow.locator('td[data-slot=table-select-cell]').click()
    await expect(box).toBeChecked()
    expect(page.url()).toBe(url)
    const bar = page.getByRole('toolbar', { name: /Bulk actions/ })
    await expect(bar).toContainText(/1 .+ selected/)
    await expect(
      bar.getByRole('button', { name: /Archive|Restore/ })
    ).toBeVisible()

    // The header box ticks the page (the first table's, on Projects).
    await page
      .getByRole('checkbox', { name: /^Select all/ })
      .first()
      .click()
    await expect(bar).toContainText(/selected/)

    await bar.getByRole('button', { name: 'Clear selection' }).click()
    await expect(bar).toHaveCount(0)
  })
}
