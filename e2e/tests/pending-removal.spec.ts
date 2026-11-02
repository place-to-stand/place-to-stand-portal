import { expect, test } from '@playwright/test'

/**
 * Every sheet list removes by marking the card "Pending removal" with Undo
 * (never dropping it). Project Members is the one checked here: a member is
 * added and removed without saving, and the sheet is discarded.
 */
test('removing a project member leaves Pending removal with Undo', async ({
  page,
}) => {
  await page.goto('/projects')
  // The row itself is a button whose name includes its actions: target the
  // action's own button.
  const edit = page.locator('button[aria-label="Edit project"]').first()
  const hasProject = await edit
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  test.skip(!hasProject, 'no project to edit')
  await edit.click()
  const sheet = page.getByRole('dialog')
  const members = sheet.locator('section', {
    has: page.getByRole('heading', { name: 'Members', exact: true }),
  })
  await expect(members).toBeVisible()

  const add = members.getByRole('button', { name: 'Add member' }).first()
  // The + stays off until the staff list loads.
  const canAdd = await expect(add)
    .toBeEnabled({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  test.skip(!canAdd, 'no sales staff to add')
  await add.click()
  const option = page.getByRole('option').first()
  const hasOption = await option
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false)
  test.skip(!hasOption, 'no sales staff to add')
  await option.click()
  // A second member, when there is one, so order can be checked.
  if (await add.isEnabled()) {
    await add.click()
    const second = page.getByRole('option').first()
    if (await second.isVisible().catch(() => false)) await second.click()
    else await page.keyboard.press('Escape')
  }
  const cardTitles = () =>
    members.locator('.font-medium.truncate').allTextContents()
  const before = await cardTitles()

  const remove = members.getByRole('button', { name: /^Remove / }).first()
  await expect(remove).toBeVisible()
  await remove.click()
  // The card stays where it was, dimmed, with Undo.
  await expect(members.getByText('Pending removal')).toBeVisible()
  expect(await cardTitles()).toEqual(before)
  await members.getByRole('button', { name: /^Undo removing/ }).click()
  await expect(members.getByText('Pending removal')).toHaveCount(0)
  expect(await cardTitles()).toEqual(before)
  await expect(
    members.getByRole('button', { name: /^Remove / }).first()
  ).toBeVisible()

  await page.keyboard.press('Escape')
  const discard = page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard' })
  if (await discard.isVisible().catch(() => false)) await discard.click()
  await expect(sheet).toBeHidden()
})
