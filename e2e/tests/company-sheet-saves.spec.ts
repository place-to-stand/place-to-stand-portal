import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test'

/**
 * The company sheet writes only on Save, and Save is one server action (one
 * database transaction): the company, its people and its billing together.
 * Runs only with E2E_WRITES=1, against a throwaway database: each test
 * makes a company and archives it again.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

const isServerAction = (request: Request) =>
  request.method() === 'POST' && Boolean(request.headers()['next-action'])

/**
 * Clicks Save and returns the server actions sent until the first one
 * answered: the save itself, plus anything sent alongside it.
 */
async function saveAndCountActions(page: Page, save: Locator) {
  const actions: Request[] = []
  const listener = (request: Request) => {
    if (isServerAction(request)) actions.push(request)
  }
  page.on('request', listener)
  const answered = page.waitForResponse(response =>
    isServerAction(response.request())
  )
  await save.click()
  await answered
  page.off('request', listener)
  return actions.length
}

/** Fills the create sheet's name and adds the first person the picker offers. */
async function startCompany(page: Page, name: string) {
  await page.goto('/companies?company=new')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Name').fill(name)

  await sheet.getByRole('tab', { name: 'People' }).click()
  await sheet.getByRole('button', { name: 'Add person' }).first().click()
  const person = page
    .getByRole('option')
    .filter({ hasNotText: /^Create/ })
    .first()
  // The option's first line is the name; the email and company follow it.
  const personName = (
    (await person.locator('span.font-medium').first().textContent()) ?? ''
  ).trim()
  await person.click()
  await expect(sheet.getByText('Joins on save')).toBeVisible()
  return { sheet, personName }
}

async function openCompany(page: Page, name: string) {
  await page.goto(`/companies?q=${encodeURIComponent(name)}`)
  await page.getByText(name, { exact: true }).first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  return sheet
}

/** Put it back: stop billing (if on) and archive the company. */
async function cleanUp(page: Page, name: string) {
  const sheet = await openCompany(page, name)
  await sheet.getByRole('tab', { name: 'Billing' }).click()
  const toggle = sheet.getByRole('switch', { name: 'Bill this company' })
  if ((await toggle.getAttribute('aria-checked')) === 'true') {
    await toggle.click()
    await sheet.getByRole('combobox', { name: 'Last month billed' }).click()
    await page.getByRole('option', { name: /\(last month\)$/ }).click()
    await sheet.getByRole('button', { name: 'Save changes' }).click()
    await expect(sheet).toBeHidden()
    await openCompany(page, name)
  }
  const reopened = page.getByRole('dialog')
  await reopened.getByRole('button', { name: 'Archive company' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Archive company', exact: true })
    .click()
  await expect(reopened).toBeHidden()
}

test('creating a company with a person and billing is one Save', async ({
  page,
}) => {
  const name = `E2E one-save company ${Date.now()}`
  const { sheet, personName } = await startCompany(page, name)

  await sheet.getByRole('tab', { name: 'Billing' }).click()
  await sheet.getByRole('switch', { name: 'Bill this company' }).click()
  await expect(
    sheet.getByText('Saving makes this company a client.')
  ).toBeVisible()

  const actions = await saveAndCountActions(
    page,
    sheet.getByRole('button', { name: 'Create company' })
  )
  expect(actions).toBe(1)
  await expect(sheet).toBeHidden()

  const saved = await openCompany(page, name)
  await expect(saved.getByText('Client', { exact: true }).first()).toBeVisible()
  await saved.getByRole('tab', { name: 'People' }).click()
  await expect(
    saved.getByText(personName, { exact: true }).first()
  ).toBeVisible()
  await page.keyboard.press('Escape')

  await cleanUp(page, name)
})

test('billing through the end of the month, then restarting, keeps a client', async ({
  page,
}) => {
  const name = `E2E stop-restart ${Date.now()}`
  const { sheet } = await startCompany(page, name)
  await sheet.getByRole('tab', { name: 'Billing' }).click()
  await sheet.getByRole('switch', { name: 'Bill this company' }).click()
  await sheet.getByRole('button', { name: 'Create company' }).click()
  await expect(sheet).toBeHidden()

  // Stop, billed through the end of this month (the default).
  let billing = await openCompany(page, name)
  await billing.getByRole('tab', { name: 'Billing' }).click()
  await billing.getByRole('switch', { name: 'Bill this company' }).click()
  await expect(
    billing.getByRole('combobox', { name: 'Last month billed' })
  ).toContainText('(this month)')
  await billing.getByRole('button', { name: 'Save changes' }).click()
  await expect(billing).toBeHidden()

  // Still a client this month, with the stop scheduled: the switch stays
  // on, the terms stay editable, and Keep billing cancels the stop.
  billing = await openCompany(page, name)
  await billing.getByRole('tab', { name: 'Billing' }).click()
  await expect(billing.getByText(/^Billing stops after /)).toBeVisible()
  await expect(
    billing.getByRole('switch', { name: 'Bill this company' })
  ).toHaveAttribute('aria-checked', 'true')
  await expect(
    billing.getByText('Client', { exact: true }).first()
  ).toBeVisible()
  await expect(billing.getByText('Billing type', { exact: true })).toBeVisible()

  // Keep billing: the scheduled stop is cancelled.
  await billing.getByRole('button', { name: 'Keep billing' }).click()
  await expect(
    billing.getByText('Saving cancels the stop and keeps billing this company.')
  ).toBeVisible()
  await billing.getByRole('button', { name: 'Save changes' }).click()
  await expect(billing).toBeHidden()

  billing = await openCompany(page, name)
  await billing.getByRole('tab', { name: 'Billing' }).click()
  await expect(
    billing.getByRole('switch', { name: 'Bill this company' })
  ).toHaveAttribute('aria-checked', 'true')
  await expect(billing.getByText(/^Billing stops after /)).toHaveCount(0)
  await page.keyboard.press('Escape')

  await cleanUp(page, name)
})

test('restarting a former client shows its last terms to edit', async ({
  page,
}) => {
  // A former client can't be made from scratch within one month (a stretch
  // stopped before its first billed month is removed), so this opens one the
  // database already has and discards the change.
  await page.goto('/companies?type=former')
  // Company rows have several cells; the empty state is one wide cell.
  const rows = page
    .locator('tbody tr')
    .filter({ has: page.locator('td:nth-child(2)') })
  test.skip((await rows.count()) === 0, 'no former client in this database')
  await rows.first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('tab', { name: 'Billing' }).click()

  const toggle = sheet.getByRole('switch', { name: 'Bill this company' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  // On: its last terms fill the form, editable in the same Save.
  await toggle.click()
  await expect(
    sheet.getByText(/^Saving restarts billing with these terms/)
  ).toBeVisible()
  await expect(sheet.getByText('Billing type', { exact: true })).toBeVisible()
  await expect(
    sheet.getByRole('combobox', { name: 'First month billed' })
  ).toBeVisible()

  await page.keyboard.press('Escape')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard' })
    .click()
  await expect(sheet).toBeHidden()
})

test('a billed company is not archived: stop billing first', async ({
  page,
}) => {
  const name = `E2E archive-billed ${Date.now()}`
  const { sheet } = await startCompany(page, name)
  await sheet.getByRole('tab', { name: 'Billing' }).click()
  await sheet.getByRole('switch', { name: 'Bill this company' }).click()
  await sheet.getByRole('button', { name: 'Create company' }).click()
  await expect(sheet).toBeHidden()

  // The sheet's archive button is disabled, with the reason.
  const saved = await openCompany(page, name)
  const archive = saved.getByRole('button', { name: 'Archive company' })
  await expect(archive).toBeDisabled()
  // The reason shows on hovering its wrapper (the button ignores the pointer).
  await archive.locator('xpath=../..').hover()
  await expect(page.getByText('Stop billing first.').first()).toBeVisible()
  await page.keyboard.press('Escape')

  // So is the list's.
  await page.goto(`/companies?q=${encodeURIComponent(name)}`)
  const row = page.locator('tbody tr').filter({ hasText: name })
  await expect(
    row.getByRole('button', { name: 'Archive company' })
  ).toBeDisabled()

  // cleanUp stops billing ("last month") first, then archives.
  await cleanUp(page, name)
})

test('a save made since the sheet opened refuses the older sheet', async ({
  page,
  context,
}) => {
  const name = `E2E two-tabs ${Date.now()}`
  const { sheet } = await startCompany(page, name)
  await sheet.getByRole('button', { name: 'Create company' }).click()
  await expect(sheet).toBeHidden()

  // The same company open in two tabs.
  const first = await openCompany(page, name)
  const other = await context.newPage()
  const second = await openCompany(other, name)

  await first.getByLabel('Website').fill('https://first.example.com')
  await first.getByRole('button', { name: 'Save changes' }).click()
  await expect(first).toBeHidden()

  await second.getByLabel('Website').fill('https://second.example.com')
  await second.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    second.getByText(
      'Someone else saved this company. Reload to see their changes.'
    )
  ).toBeVisible()
  await expect(second).toBeVisible()
  await other.close()

  // The first save stands.
  const saved = await openCompany(page, name)
  await expect(saved.getByLabel('Website')).toHaveValue(/first\.example\.com/)
  await page.keyboard.press('Escape')

  await cleanUp(page, name)
})
