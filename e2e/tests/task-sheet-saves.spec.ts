import { expect, test, type Page, type Request } from '@playwright/test'

/**
 * The task sheet writes only when Save is clicked, and Save is one request
 * (one server action, one database transaction). Runs only with
 * E2E_WRITES=1, against a throwaway database: the create test makes a task
 * and archives it again.
 *
 *   E2E_PLANNING_TASK_PATH  a task-sheet URL for a task on a project with a
 *                           linked GitHub repo, e.g.
 *                           /projects/acme/site/tasks?task=<uuid>
 *                           (the planning test skips without it)
 */
test.skip(!process.env.E2E_WRITES, 'set E2E_WRITES=1 on a throwaway database')

const isServerAction = (request: Request) =>
  request.method() === 'POST' && Boolean(request.headers()['next-action'])

/** Records every POST and server-action request from now on. */
function recordWrites(page: Page) {
  const posts: Request[] = []
  const listener = (request: Request) => {
    if (request.method() === 'POST') posts.push(request)
  }
  page.on('request', listener)
  return {
    posts,
    serverActions: () => posts.filter(isServerAction),
    stop: () => page.off('request', listener),
  }
}

test('opening the planning panel writes nothing', async ({ page }) => {
  const path = process.env.E2E_PLANNING_TASK_PATH
  test.skip(
    !path,
    'set E2E_PLANNING_TASK_PATH to a task on a repo-linked project'
  )

  await page.goto(path!)
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await page.waitForLoadState('networkidle')

  const writes = recordWrites(page)
  const planningRead = page.waitForResponse(
    response =>
      /\/api\/tasks\/[0-9a-f-]{36}\/planning$/.test(
        new URL(response.url()).pathname
      ) && response.request().method() === 'GET'
  )

  await sheet.getByRole('button', { name: 'Planning' }).click()
  // The panel loaded (a read), showing either the empty state or the plan.
  expect((await planningRead).ok()).toBe(true)
  await page.waitForLoadState('networkidle')
  writes.stop()

  expect(writes.posts.map(request => request.url())).toEqual([])
})

test('creating a task with an assignee is one request on Save', async ({
  page,
}) => {
  const title = `E2E one-save ${Date.now()}`

  // The global sheet host fills the assignee with the signed-in admin.
  await page.goto('/time-logs?task=new')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()

  const beforeSave = recordWrites(page)

  await sheet.getByLabel('Title').fill(title)
  await sheet.getByRole('combobox', { name: 'Project' }).click()
  await page.getByRole('option').first().click()
  await expect(
    sheet.getByRole('combobox', { name: 'Assignee' })
  ).not.toHaveText(/Unassigned/)

  beforeSave.stop()
  expect(beforeSave.posts.map(request => request.url())).toEqual([])

  const onSave = recordWrites(page)
  await sheet.getByRole('button', { name: 'Create task' }).click()
  await expect(sheet).toBeHidden()
  await page.waitForLoadState('networkidle')
  onSave.stop()

  expect(onSave.serverActions()).toHaveLength(1)

  // Put it back: archive the task just created (assigned to me, so it is on
  // My Tasks).
  await page.goto('/my/tasks')
  await page.getByText(title, { exact: true }).first().click()
  const created = page.getByRole('dialog')
  await created.getByRole('button', { name: 'Archive task' }).click()
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(created).toBeHidden()
})
