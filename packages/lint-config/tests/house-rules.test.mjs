import { ruleTester } from './tester.mjs'

import { pts } from '../plugin.mjs'

const tester = ruleTester({ jsx: true })

const run = (id, cases) => tester.run(id, pts.rules[id], cases)

run('save-not-gated-on-dirty', {
  valid: [
    '<Button disabled={isPending}>Save</Button>',
    // Not a Save: sending waits for a save (rule 8).
    '<Button disabled={isPending || hasUnsavedChanges}>Mark as sent</Button>',
  ],
  invalid: [
    { code: '<Button disabled={!isDirty}>Save</Button>', errors: 1 },
    {
      code: "<Button type='submit' disabled={!form.formState.isDirty}>Go</Button>",
      errors: 1,
    },
  ],
})

run('archive-confirm', {
  valid: [
    "<ConfirmDialog title='Discard changes?' />",
    "<ArchiveConfirmDialog entity='task' name='x' list='the board' />",
  ],
  invalid: [
    {
      code: "<ConfirmDialog title='Archive time log?' />",
      errors: [{ messageId: 'archive' }],
    },
    {
      code: '<ConfirmDialog title={`Archive ${name}?`} />',
      errors: [{ messageId: 'archive' }],
    },
  ],
})

run('filter-select', {
  valid: [
    '<FilterBar><FilterSelect /></FilterBar>',
    {
      code: "import { Select } from '@placetostand/ui/select'",
      filename: '/x/page-size-select.tsx',
    },
  ],
  invalid: [
    { code: '<FilterBar><div><Select /></div></FilterBar>', errors: 1 },
    {
      code: "import { Select } from '@placetostand/ui/select'",
      filename: '/x/lead-filters.tsx',
      errors: 1,
    },
  ],
})
