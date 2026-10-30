import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * A long unbroken word in a rich text field must wrap inside the field, both
 * while editing and while the sheet saves (the editor turns read-only and is
 * wrapped in DisabledFieldTooltip, which once let it widen past the sheet).
 *
 * Read-only: uses the task create sheet and holds every non-GET request,
 * then drops it, so nothing is ever written.
 */
const LONG_WORD = 'A'.repeat(300)

async function holdAndDropWrites(page: Page) {
  await page.route('**/*', async route => {
    if (route.request().method() === 'GET') return route.continue()
    // Long enough to measure the saving state, then never sent.
    await new Promise(resolve => setTimeout(resolve, 5_000))
    return route.abort()
  })
}

async function expectNoHorizontalOverflow(sheet: Locator) {
  const sizes = await sheet.evaluate(dialog => {
    const editor = dialog.querySelector<HTMLElement>('[data-rich-text-editor]')
    const content = editor?.querySelector<HTMLElement>('.ProseMirror')
    const form = dialog.querySelector<HTMLElement>('form')
    return [editor, content, form].map(el =>
      el ? { scroll: el.scrollWidth, client: el.clientWidth } : null
    )
  })
  for (const size of sizes) {
    expect(size).not.toBeNull()
    expect(size!.scroll).toBeLessThanOrEqual(size!.client)
  }
}

test('a long word stays inside the task description, editing and saving', async ({
  page,
}) => {
  await holdAndDropWrites(page)
  await page.goto('/time-logs?task=new')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()

  await sheet.locator('.ProseMirror').first().click()
  await page.keyboard.insertText(`${LONG_WORD} https://example.com/${'path-'.repeat(60)}`)
  await expectNoHorizontalOverflow(sheet)

  // Fill the required fields so Save starts the (held) request.
  await sheet.getByLabel('Title').fill('E2E overflow check (never saved)')
  await sheet.getByRole('combobox', { name: 'Project' }).click()
  await page.getByRole('option').first().click()
  await sheet.getByRole('button', { name: 'Create task' }).click()

  // Saving: the editor is read-only until the request settles.
  await expect(sheet.locator('.ProseMirror').first()).toHaveAttribute(
    'contenteditable',
    'false'
  )
  await expectNoHorizontalOverflow(sheet)
})
