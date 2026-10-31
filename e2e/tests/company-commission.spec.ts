import { expect, test } from '@playwright/test'

/**
 * Commission on a client's billing uses the shared entity list: removing a
 * closer leaves a "Pending removal" card with Undo, nothing saves until Save.
 * Read-only: the sheet is discarded at the end.
 */
test('removing a closer can be undone before saving', async ({ page }) => {
  await page.goto('/companies')
  const sheet = page.getByRole('dialog')
  // Open client companies until one has a closer.
  const rows = page.locator('tbody tr').filter({ hasText: 'Client' })
  const count = Math.min(await rows.count(), 8)
  let found = false
  for (let i = 0; i < count && !found; i++) {
    await rows.nth(i).locator('td').first().click()
    await expect(
      sheet.getByRole('heading', { name: 'Commission', exact: true })
    ).toBeVisible()
    found =
      (await sheet.getByRole('button', { name: /^Remove closer/ }).count()) > 0
    if (!found) {
      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
    }
  }
  test.skip(!found, 'needs a client with a closer')

  await expect(
    sheet.getByRole('heading', { name: 'Origination', exact: true })
  ).toBeVisible()
  await sheet
    .getByRole('button', { name: /^Remove closer/ })
    .first()
    .click()
  await expect(sheet.getByText('Pending removal').first()).toBeVisible()
  await sheet
    .getByRole('button', { name: /^Undo removing/ })
    .first()
    .click()
  await expect(
    sheet.getByRole('button', { name: /^Remove closer/ }).first()
  ).toBeVisible()

  await page.keyboard.press('Escape')
  const discard = page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard' })
  if (await discard.isVisible().catch(() => false)) await discard.click()
  await expect(sheet).toBeHidden()
})
