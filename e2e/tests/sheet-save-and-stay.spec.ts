import { expect, test, type Locator, type Page } from '@playwright/test'

import { archiveFromSheetMenu } from './helpers'

/**
 * Save (keep open), ⇧⌘S: every sheet saves and stays open. A create sheet
 * turns into the new record's sheet (the URL's `new` becomes its id); an
 * edit sheet re-baselines, so a second keep-open save goes through (no
 * "someone else saved" refusal) and closing asks nothing.
 * Runs only with E2E_WRITES=1, against a throwaway database with a client
 * company ("Seed Client") and one of its projects.
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const CLIENT = process.env.E2E_CLIENT_NAME ?? 'Seed Client'

const keepOpenButton = (sheet: Locator) =>
  sheet.getByRole('button', { name: /^(Save|Create) and keep open/ })

/**
 * Saves with the button and checks the sheet stayed: the button reads
 * "Saved" and no success toast shows (the sheet itself is the result).
 */
async function keepOpen(page: Page, sheet: Locator, toast: RegExp) {
  await keepOpenButton(sheet).click()
  await expect(keepOpenButton(sheet)).toHaveText('Saved')
  await expect(sheet).toBeVisible()
  await expect(keepOpenButton(sheet)).toBeEnabled()
  await expect(page.getByText(toast)).toHaveCount(0)
}

/** The create sheet became the record's edit sheet: returns its id. */
async function expectBecameRecord(page: Page, sheet: Locator, param: string) {
  await expect(page).toHaveURL(new RegExp(`[?&]${param}=${UUID}`))
  await expect(
    sheet.getByRole('button', { name: /^Save and close/ })
  ).toBeVisible()
  const id = new URL(page.url()).searchParams.get(param)
  expect(id).toMatch(new RegExp(`^${UUID}$`))
  return id as string
}

/** Closing right after a keep-open save asks nothing: nothing is unsaved. */
async function closeClean(page: Page, sheet: Locator) {
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(sheet).toBeHidden()
}

async function confirmArchive(page: Page) {
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Archive/ })
    .click()
}

async function pickOption(
  page: Page,
  combobox: Locator,
  name: string | RegExp
) {
  await combobox.click()
  await page.getByRole('option', { name }).first().click()
}

test('company: create, then two keep-open edits, then close clean', async ({
  page,
}) => {
  const name = `E2E stay company ${Date.now()}`
  await page.goto('/companies?company=new')
  const sheet = page.getByRole('dialog')
  await sheet.getByPlaceholder('Acme Inc.').fill(name)
  await keepOpen(page, sheet, /Company created/)
  const id = await expectBecameRecord(page, sheet, 'company')
  await expect(sheet.getByRole('heading', { name })).toBeVisible()

  await sheet.getByPlaceholder('acme.com').fill('stay-one.example')
  await keepOpen(page, sheet, /Company saved/)
  await sheet.getByPlaceholder('acme.com').fill('stay-two.example')
  // The keyboard shortcut does the same as the button.
  await page.keyboard.press('ControlOrMeta+Shift+S')
  await expect(keepOpenButton(sheet)).toHaveText('Saved')
  await expect(sheet).toBeVisible()
  await expect(keepOpenButton(sheet)).toBeEnabled()
  await expect(
    sheet.getByText(/saved since you opened|newer save/i)
  ).toHaveCount(0)
  await closeClean(page, sheet)

  await page.goto(`/companies?company=${id}`)
  const reopened = page.getByRole('dialog')
  await expect(reopened.getByPlaceholder('acme.com')).toHaveValue(/stay-two/)
  await archiveFromSheetMenu(reopened)
  await confirmArchive(page)
  await expect(reopened).toBeHidden()
})

test('person: create, then two keep-open edits, then close clean', async ({
  page,
}) => {
  const stamp = Date.now()
  await page.goto('/people?contact=new')
  const sheet = page.getByRole('dialog')
  await sheet.getByPlaceholder('John Doe').fill(`E2E stay person ${stamp}`)
  await sheet
    .getByPlaceholder('contact@example.com')
    .fill(`e2e-stay-${stamp}@local.test`)
  await keepOpen(page, sheet, /Person created|created/i)
  const id = await expectBecameRecord(page, sheet, 'contact')

  await sheet.getByPlaceholder('(555) 123-4567').fill('555 010 0001')
  await keepOpen(page, sheet, /Person saved|saved/i)
  await sheet.getByPlaceholder('(555) 123-4567').fill('555 010 0002')
  await keepOpen(page, sheet, /Person saved|saved/i)
  await closeClean(page, sheet)

  await page.goto(`/people?contact=${id}`)
  const reopened = page.getByRole('dialog')
  await expect(reopened.getByPlaceholder('(555) 123-4567')).toHaveValue(/0002/)
  await archiveFromSheetMenu(reopened)
  await confirmArchive(page)
  await expect(reopened).toBeHidden()
})

test('task: create, then two keep-open edits, then close clean', async ({
  page,
}) => {
  const title = `E2E stay task ${Date.now()}`
  await page.goto('/my/tasks?task=new')
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Title').fill(title)
  await pickOption(
    page,
    sheet.getByRole('combobox', { name: 'Project or Lead' }),
    /Seed Project/
  )
  await keepOpen(page, sheet, /Task created/)
  const id = await expectBecameRecord(page, sheet, 'task')

  await sheet.getByLabel('Title').fill(`${title} one`)
  await keepOpen(page, sheet, /Task saved|Task updated/)
  await sheet.getByLabel('Title').fill(`${title} two`)
  await keepOpen(page, sheet, /Task saved|Task updated/)
  await closeClean(page, sheet)

  await page.goto(`/my/tasks?task=${id}`)
  const reopened = page.getByRole('dialog')
  await expect(reopened.getByLabel('Title')).toHaveValue(`${title} two`)
  await archiveFromSheetMenu(reopened)
  await confirmArchive(page)
  await expect(reopened).toBeHidden()
})

test('lead: create, then two keep-open edits, then close clean', async ({
  page,
}) => {
  await page.goto('/leads?lead=new')
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('combobox', { name: 'Person' }).click()
  await page
    .getByRole('option')
    .filter({ hasNotText: /^Create/ })
    .first()
    .click()
  await keepOpen(page, sheet, /Lead created/)
  const id = await expectBecameRecord(page, sheet, 'lead')

  await sheet.getByRole('combobox', { name: 'Source' }).click()
  await page
    .getByRole('option')
    .filter({ hasNotText: 'Not set' })
    .first()
    .click()
  await sheet.getByRole('textbox', { name: 'Source info' }).fill('first')
  await keepOpen(page, sheet, /Lead saved/)
  await sheet.getByRole('textbox', { name: 'Source info' }).fill('second')
  await keepOpen(page, sheet, /Lead saved/)
  await closeClean(page, sheet)

  await page.goto(`/leads?lead=${id}`)
  const reopened = page.getByRole('dialog')
  await expect(
    reopened.getByRole('textbox', { name: 'Source info' })
  ).toHaveValue('second')
  await archiveFromSheetMenu(reopened)
  await confirmArchive(page)
  await expect(reopened).toBeHidden()
})

test('project: create, then two keep-open edits, then close clean', async ({
  page,
}) => {
  const name = `E2E stay project ${Date.now()}`
  await page.goto('/projects?project=new')
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('textbox', { name: 'Name' }).fill(name)
  await pickOption(
    page,
    sheet.getByRole('combobox', { name: 'Client' }),
    CLIENT
  )
  await keepOpen(page, sheet, /Project created/)
  const id = await expectBecameRecord(page, sheet, 'project')

  await sheet.getByRole('textbox', { name: 'Name' }).fill(`${name} one`)
  await keepOpen(page, sheet, /Project saved/)
  await sheet.getByRole('textbox', { name: 'Name' }).fill(`${name} two`)
  await keepOpen(page, sheet, /Project saved/)
  await closeClean(page, sheet)

  await page.goto(`/projects?project=${id}`)
  const reopened = page.getByRole('dialog')
  await expect(reopened.getByRole('textbox', { name: 'Name' })).toHaveValue(
    `${name} two`
  )
  await archiveFromSheetMenu(reopened)
  await confirmArchive(page)
  await expect(reopened).toBeHidden()
})

test('hour block: create, then two keep-open edits, then close clean', async ({
  page,
}) => {
  await page.goto('/hour-blocks?hour-block=new')
  const sheet = page.getByRole('dialog')
  await pickOption(
    page,
    sheet.getByRole('combobox', { name: 'Client' }),
    CLIENT
  )
  const hours = sheet.getByRole('spinbutton', { name: 'Hours purchased' })
  await hours.fill('7')
  await keepOpen(page, sheet, /Hour block created/)
  const id = await expectBecameRecord(page, sheet, 'hour-block')

  await hours.fill('8')
  await keepOpen(page, sheet, /Hour block saved|Hour block updated/)
  await hours.fill('9')
  await keepOpen(page, sheet, /Hour block saved|Hour block updated/)
  await closeClean(page, sheet)

  await page.goto(`/hour-blocks?hour-block=${id}`)
  const reopened = page.getByRole('dialog')
  await expect(
    reopened.getByRole('spinbutton', { name: 'Hours purchased' })
  ).toHaveValue('9')
  await archiveFromSheetMenu(reopened)
  await confirmArchive(page)
  await expect(reopened).toBeHidden()
})

test('invoice: a keep-open save never adds its new lines twice', async ({
  page,
}) => {
  await page.goto('/invoices?invoice=new')
  const sheet = page.getByRole('dialog')
  await pickOption(
    page,
    sheet.getByRole('combobox', { name: 'Client' }),
    CLIENT
  )
  const qty = sheet.getByRole('spinbutton', { name: 'Qty' })
  await expect(qty).toHaveCount(1)
  await keepOpen(page, sheet, /Invoice created/)
  const id = await expectBecameRecord(page, sheet, 'invoice')
  await expect(qty).toHaveCount(1)

  // A new line, saved twice: it must stay one line.
  await sheet.getByRole('button', { name: 'Add line item' }).first().click()
  await expect(qty).toHaveCount(2)
  await pickOption(
    page,
    sheet.getByRole('combobox', { name: 'Item type' }).last(),
    'Development Hours'
  )
  await qty.last().fill('3')
  await keepOpen(page, sheet, /Invoice saved/)
  await expect(qty).toHaveCount(2)
  await keepOpen(page, sheet, /Invoice saved/)
  await closeClean(page, sheet)

  await page.goto(`/invoices?invoice=${id}`)
  const reopened = page.getByRole('dialog')
  const reopenedQty = reopened.getByRole('spinbutton', { name: 'Qty' })
  await expect(reopenedQty).toHaveCount(2)
  await expect(reopenedQty.last()).toHaveValue('3')
  await archiveFromSheetMenu(reopened)
  await confirmArchive(page)
  await expect(reopened).toBeHidden()
})
