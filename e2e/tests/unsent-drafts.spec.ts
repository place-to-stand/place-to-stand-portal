import { expect, test, type Page } from '@playwright/test'

/**
 * Comments and lead updates save on their own click, outside the sheet's
 * Save. Closing the sheet with one typed but not sent asks first. Read-only:
 * nothing is posted.
 */

// A click on the page beside the sheet: the backdrop.
const clickOutside = (page: Page) => page.mouse.click(20, 500)

test.use({ viewport: { width: 1600, height: 1000 } })

test('closing a task with an unsent comment asks first', async ({ page }) => {
  await page.goto('/projects/harbor-pine/online-store/tasks')
  await page.locator('[aria-roledescription="sortable"]').first().click()
  const sheet = page.getByRole('dialog').last()

  // An untouched sheet closes at once.
  await clickOutside(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.locator('[aria-roledescription="sortable"]').first().click()
  await sheet.getByRole('button', { name: 'Add comment' }).first().click()
  await sheet.locator('.ProseMirror').last().click()
  await page.keyboard.type('Half a thought')

  await clickOutside(page)
  const ask = page.getByRole('alertdialog')
  await expect(ask.getByText('Discard this comment?')).toBeVisible()
  await ask.getByRole('button', { name: 'Keep writing' }).click()
  await expect(sheet.getByText('Half a thought')).toBeVisible()

  // Save and close asks too, before it saves; staying saves nothing.
  await sheet.getByRole('button', { name: 'Save and close' }).click()
  await expect(ask.getByText('Discard this comment?')).toBeVisible()
  await ask.getByRole('button', { name: 'Keep writing' }).click()
  await expect(sheet.getByText('Half a thought')).toBeVisible()

  await clickOutside(page)
  await ask.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('closing a lead with an unsent update asks first', async ({ page }) => {
  await page.goto('/leads')
  await page.locator('[aria-roledescription="sortable"]').first().click()
  const sheet = page.getByRole('dialog').last()
  await sheet.getByRole('button', { name: 'Add update' }).first().click()
  await sheet.locator('[id$="-body"] .ProseMirror').click()
  await page.keyboard.type('Called them back')

  await clickOutside(page)
  const ask = page.getByRole('alertdialog')
  await expect(ask.getByText('Discard this update?')).toBeVisible()
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet.getByText('Called them back')).toBeVisible()

  await clickOutside(page)
  await ask.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
