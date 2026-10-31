import { expect, test } from '@playwright/test'

// Sending an invoice is blocked while it has unsaved edits, so a client
// never receives something other than what is on screen. Read-only: it
// edits a field but never saves or sends.
test('a draft invoice with unsaved edits cannot be sent', async ({ page }) => {
  await page.goto('/invoices')
  await page.waitForLoadState('networkidle')
  const draft = page.getByRole('row').filter({ hasText: /Draft/ }).first()
  test.skip((await draft.count()) === 0, 'No draft invoice to open.')
  await draft.click()

  const sheet = page.getByRole('dialog')
  const send = sheet.getByRole('button', { name: 'Send to client' })
  await expect(send).toBeEnabled()

  const notes = sheet.getByLabel(/notes|memo/i).first()
  test.skip((await notes.count()) === 0, 'No free-text field to edit.')
  await notes.fill(`${(await notes.inputValue()) || ''} (edited)`)

  await expect(send).toBeDisabled()
  await expect(
    sheet.getByRole('button', { name: 'Mark as sent' })
  ).toBeDisabled()
  await expect(sheet.getByTestId('invoice-send-blocked')).toBeVisible()
})
