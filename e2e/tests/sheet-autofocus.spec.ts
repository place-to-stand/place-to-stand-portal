import { expect, test } from '@playwright/test'

// Opening a sheet puts the cursor in its first field (SheetContent).
test('the task create sheet opens with the cursor in Title', async ({
  page,
}) => {
  await page.goto('/time-logs?task=new')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  const focused = page.locator(':focus')
  await expect(focused).toHaveCount(1)
  await expect(focused).toHaveAttribute('name', /title/i)
  // Typing goes straight into it.
  await page.keyboard.type('Autofocus check')
  await expect(focused).toHaveValue('Autofocus check')
  await page.keyboard.press('Escape')
})
