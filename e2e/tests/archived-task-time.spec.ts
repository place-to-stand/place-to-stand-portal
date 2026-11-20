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

// A link to it on its own project, Review or board, opens the task, not a
// blank "Create task" sheet.
for (const tab of ['review', 'tasks']) {
  test(`a link to an archived task opens it on the project ${tab} tab`, async ({
    page,
  }) => {
    await page.goto(
      `/projects/harbor-pine/online-store/${tab}?task=${ARCHIVED_TASK}`
    )
    const sheet = page.getByRole('dialog').last()
    await expect(sheet.getByText('Holiday banner (old)').first()).toBeVisible()
    await expect(sheet.getByText('Create task')).toHaveCount(0)
  })
}

test('a link to a task the board does not hold opens no sheet', async ({
  page,
}) => {
  await page.goto(
    '/projects/harbor-pine/online-store/tasks?task=11111111-1111-4111-8111-111111111111'
  )
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
