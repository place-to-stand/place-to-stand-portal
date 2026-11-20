import { expect, test } from '@playwright/test'

/**
 * An archived task still lists the time logged on it. Read-only: the seed's
 * "Holiday banner (old)" was archived after time was logged on it.
 */
const ARCHIVED_TASK = 'e2e0e2e0-0000-4000-8000-000000000002'

test('an archived task still shows its logged time', async ({ page }) => {
  await page.goto(`/my/home?task=${ARCHIVED_TASK}`)
  const sheet = page.getByRole('dialog').last()
  await expect(sheet.getByText('Holiday banner (old)').first()).toBeVisible()
  await expect(sheet.getByText(/^\d+(\.\d+)?h logged$/)).toBeVisible()
  await expect(sheet.getByText('Time logs could not be loaded.')).toHaveCount(0)
})
