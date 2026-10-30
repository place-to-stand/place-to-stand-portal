import { nextApp } from '@pts/eslint-config/next'

/**
 * lib/queries files that already log activity or check permissions, from
 * before the rule existed. The rule applies to every other (and every new)
 * query file. Moving each one's logging and permission checks up into
 * lib/data, lib/<domain> or the server action is follow-up D12
 * (docs/reviews/pr-279-swarm-audit.md): delete its line here when you do.
 */
const QUERY_LAYER_ALLOWLIST = [
  'lib/queries/clients/settings/client-contacts.ts',
  'lib/queries/clients/settings/list-clients.ts',
  'lib/queries/command-palette.ts',
  'lib/queries/companies.ts',
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
  'lib/queries/tasks/basic.ts',
  'lib/queries/tasks/relations.ts',
  'lib/queries/time-logs/mutations.ts',
  'lib/queries/time-logs/read.ts',
  'lib/queries/users/base.ts',
  'lib/queries/users/mutations.ts',
  'lib/queries/users/portal-account.ts',
  'lib/queries/users/settings.ts',
]

// Shared with apps/client: packages/eslint-config/next.mjs.
const config = [
  ...nextApp({
    dir: import.meta.dirname,
    entityRegistry: 'lib/entity-accents.ts',
  }),
  {
    files: ['lib/queries/**'],
    ignores: QUERY_LAYER_ALLOWLIST,
    rules: { 'pts/query-layer-purity': 'error' },
  },
]

export default config
