import { nextApp } from '@pts/lint-config/next'
import { toOxlint } from '@pts/lint-config/to-oxlint'

/**
 * lib/queries files that still log activity or check permissions, exempt
 * from the rule; it applies to every other query file. When a file's logging
 * and permission checks move up into lib/data, lib/<domain> or the server
 * action, delete its line here.
 */
const QUERY_LAYER_ALLOWLIST = [
  'lib/queries/command-palette.ts',
  'lib/queries/companies/billing/settings/client-contacts.ts',
  'lib/queries/companies/billing/settings/list-clients.ts',
  'lib/queries/companies/index.ts',
  'lib/queries/contacts/options.ts',
  'lib/queries/contacts/settings/contact-client-link-activity.ts',
  'lib/queries/contacts/settings/contact-clients.ts',
  'lib/queries/contacts/settings/list-contacts.ts',
  'lib/queries/hour-blocks.ts',
  'lib/queries/invoices.ts',
  'lib/queries/lead-updates.ts',
  'lib/queries/memberships.ts',
  'lib/queries/projects/listing.ts',
  'lib/queries/task-comments.ts',
  'lib/queries/tasks/relations.ts',
  'lib/queries/time-logs/mutations.ts',
  'lib/queries/time-logs/read.ts',
  'lib/queries/users/base.ts',
  'lib/queries/users/mutations.ts',
  'lib/queries/users/portal-account.ts',
  'lib/queries/users/settings.ts',
]

// Shared with apps/client: packages/lint-config/next.mjs.
export default toOxlint([
  ...nextApp({
    dir: import.meta.dirname,
    portal: 'internal',
    entityRegistry: 'lib/entity-accents.ts',
    sheetRegistry: 'lib/sheets/entities.ts',
    pagePanel: 'components/layout/page-panel.tsx',
    queryLayerAllowlist: QUERY_LAYER_ALLOWLIST,
    apiRouteGuard: true,
  }),
  {
    // One way to check roles: capabilities.
    rules: { 'pts/no-role-literal': 'error' },
  },
])
