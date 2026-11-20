import { expect, test } from '@playwright/test'

// Sending an invoice is blocked while it has unsaved edits, so a client
// never receives something other than what is on screen. Read-only: it
// edits a field but never saves or sends.
test('a draft invoice with unsaved edits cannot be sent', async ({ page }) => {
  await page.goto('/invoices')
  await page.waitForLoadState('networkidle')
  const draft = page.locator('tbody tr').filter({ hasText: 'Draft' }).first()
  await expect(draft).toBeVisible()
  await draft.click()

  const sheet = page.getByRole('dialog')
  const send = sheet.getByRole('button', { name: 'Send to client' })
  await expect(send).toBeEnabled()

  const notes = sheet.getByLabel(/notes|memo/i).first()
  await expect(notes).toBeVisible()
  await notes.fill(`${(await notes.inputValue()) || ''} (edited)`)

  await expect(send).toBeDisabled()
  await expect(
    sheet.getByRole('button', { name: 'Mark as sent' })
  ).toBeDisabled()
  await expect(sheet.getByTestId('invoice-send-blocked')).toBeVisible()
})
