import { expect, test, type Page } from '@playwright/test'

/**
 * Starting another comment or update form never drops one with changes
 * without asking. Posts a lead update and a task comment; run only with
 * E2E_WRITES=1 on a throwaway database.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')
test.use({ viewport: { width: 1600, height: 1000 } })

const typeInto = async (
  page: Page,
  editor: ReturnType<Page['locator']>,
  text: string
) => {
  await editor.click()
  await page.keyboard.type(text)
}

test('lead updates: switching forms asks about the one it drops', async ({
  page,
}) => {
  await page.goto('/leads')
  await page.locator('[aria-roledescription="sortable"]').first().click()
  const sheet = page.getByRole('dialog').last()
  const ask = page.getByRole('alertdialog')
  const posted = `Posted ${Date.now()}`

  await sheet.getByRole('button', { name: 'Add update' }).first().click()
  await typeInto(page, sheet.locator('[id$="-body"] .ProseMirror'), posted)
  await sheet.getByRole('button', { name: 'Log update' }).click()
  await expect(sheet.getByText(posted)).toBeVisible()

  // A half-written new update, then Edit on the posted one.
  await sheet.getByRole('button', { name: 'Add update' }).first().click()
  await typeInto(page, sheet.locator('[id$="-body"] .ProseMirror'), 'Half new')
  await sheet
    .getByRole('button', { name: /^Actions for / })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await expect(ask.getByText('Discard this update?')).toBeVisible()
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet.getByText('Half new')).toBeVisible()

  await sheet
    .getByRole('button', { name: /^Actions for / })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await ask.getByRole('button', { name: 'Discard' }).click()
  // The new-update form closes; its text goes with it.
  await expect(sheet.getByText('Half new')).toBeHidden()

  // Changes to the update being edited, then Add update.
  await typeInto(
    page,
    sheet.locator('[id$="-body"] .ProseMirror', { hasText: posted }),
    ' changed'
  )
  await sheet.getByRole('button', { name: 'Add update' }).first().click()
  await expect(ask.getByText('Discard this update?')).toBeVisible()
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet.getByText(`${posted} changed`)).toBeVisible()
})

test('task comments: another edit or Cancel asks about changes', async ({
  page,
}) => {
  await page.goto('/projects/harbor-pine/online-store/tasks')
  await page.locator('[aria-roledescription="sortable"]').first().click()
  const sheet = page.getByRole('dialog').last()
  const ask = page.getByRole('alertdialog')
  const posted = `Comment ${Date.now()}`

  await sheet.getByRole('button', { name: 'Add comment' }).first().click()
  await typeInto(page, sheet.locator('.ProseMirror').last(), posted)
  await sheet.getByRole('button', { name: 'Post comment' }).click()
  await expect(sheet.getByText(posted)).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Comment actions' }).first()
  ).toBeEnabled()

  await sheet.getByRole('button', { name: 'Comment actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await typeInto(
    page,
    sheet.locator('.ProseMirror', { hasText: posted }),
    ' edited'
  )

  // Cancel asks; Keep editing keeps the change.
  await sheet.getByRole('button', { name: 'Cancel' }).last().click()
  await expect(ask.getByText('Discard your changes?')).toBeVisible()
  await ask.getByRole('button', { name: 'Keep editing' }).click()
  await expect(sheet.getByText(`${posted} edited`)).toBeVisible()

  // Closing the sheet asks about the edit too.
  await page.mouse.click(20, 500)
  await expect(ask.getByText('Discard your changes?')).toBeVisible()
  await ask.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
