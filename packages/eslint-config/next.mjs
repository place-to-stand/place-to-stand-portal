/**
 * Shared flat config for the two Next.js apps (apps/internal, apps/client),
 * so both portals get the same rules.
 *
 *   import { nextApp } from '@pts/eslint-config/next'
 *   export default nextApp({ dir: import.meta.dirname, entityRegistry: 'lib/entity-accents.ts' })
 *
 * `entityRegistry`: the app's entity registry (internal only). With it, entity
 * icons from lucide-react are banned outside the registry; the `*-entity-*`
 * colour classes are banned in every app either way.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

import jsxA11y from 'eslint-plugin-jsx-a11y'

import { IGNORES, NO_RLS_IMPORT, common, typed } from './base.mjs'

export const HOUSE_RULES = {
  'pts/no-radix': 'error', // rule 1
  'pts/no-align-start': 'error', // rule 4
  'pts/save-not-gated-on-dirty': 'error', // rule 6
  'pts/no-title-tooltip': 'error', // rule 11
  'pts/icon-button-tooltip': 'error', // rule 11
  'pts/archive-confirm': 'error', // one archive confirmation
  'pts/no-size-override': 'error', // rule 12
  'pts/toast-copy': 'error', // rule 14
  'pts/grid-phone-column': 'error', // rule 15
  'pts/ellipsis-character': 'error', // copy: "…"
  'pts/filter-select': 'error', // list filters are FilterSelect
  'pts/optional-label': 'error', // input.md: <FormLabel optional>
  'pts/popover-shadow': 'error', // select.md: one elevation
  'pts/figure-cell-aligned': 'error', // table.md: figures right, tabular
  'pts/fixed-table-columns': 'error', // table.md: short columns fixed, text grows
  'pts/no-details-section': 'error', // sheet.md: no "Details" heading
  'pts/no-raw-type-size': 'error', // README → Type: role utilities
  'pts/underline-not-clipped': 'error', // README → Text links: truncate-link
}

/**
 * Tables whose rows are not records, so a hard delete is right: join rows,
 * per-user layout, retention of the activity log, rate-limit buckets.
 */
const HARD_DELETE_ALLOW = [
  'activityLogs',
  'activity_logs',
  'timeLogTasks',
  'userDashboardLayouts',
  'rateLimitBuckets',
  'rate_limit_buckets',
]

/** Files that may read process.env: the env schemas, build config, scripts. */
const ENV_READERS = [
  'lib/env*.ts',
  'next.config.ts',
  'instrumentation*.ts',
  'drizzle.config.ts',
  'scripts/**',
  'playwright.config.ts',
  'e2e/**',
]

function sheetParamNames(dir, registry) {
  const source = readFileSync(join(dir, registry), 'utf8')
  const block = source.slice(source.indexOf('SHEET_ENTITIES'))
  return [...block.matchAll(/^ {2}'?([a-z][a-z-]*)'?: \{/gm)].map(m => m[1])
}

function entityIconNames(dir, registry) {
  return [
    ...readFileSync(join(dir, registry), 'utf8').matchAll(/iconName: '(\w+)'/g),
  ].map(match => match[1])
}

export function nextApp({
  dir,
  entityRegistry,
  sheetRegistry,
  pagePanel,
} = {}) {
  const restrictedImports = [NO_RLS_IMPORT]
  if (entityRegistry) {
    // Entity icons belong to the registry: read the list from it so a new
    // entity's icon is guarded the moment it is added.
    restrictedImports.push({
      name: 'lucide-react',
      importNames: entityIconNames(dir, entityRegistry),
      message:
        'Entity icons come from the registry: ENTITIES.<entity>.icon / ENTITY_ICONS in @/lib/entity-accents. For a non-entity meaning pick another glyph (e.g. CalendarClock for a timestamp).',
    })
    // A sheet's related-records list (heading, +, empty state, cards) is
    // always EntityList, which imports the + by relative path.
    restrictedImports.push({
      name: '@/components/sheets/section-add-button',
      message:
        'A section +, its list and its clickable empty state come together: use EntityList (@/components/sheets/entity-list). See docs/design-system/components/entity-list.md.',
    })
  }

  const entityColourMessage = entityRegistry
    ? 'Entity colours come from the registry: ENTITY_ACCENTS.<entity> (icon, card, cardStatic, tint, badge, sheetHeader) in @/lib/entity-accents.'
    : "Entity colours belong to the internal portal's entity registry (apps/internal/lib/entity-accents.ts); this app has none. Use the semantic tokens."

  return [
    ...nextCoreWebVitals,
    ...nextTypescript,
    ...common(),
    {
      // Lets eslint run from the repo root (pre-commit) as well as the app.
      settings: { next: { rootDir: dir } },
      rules: {
        'no-restricted-imports': ['error', { paths: restrictedImports }],
        // CLAUDE.md "Soft deletes": archive, never hard delete a record.
        'pts/no-hard-delete': ['error', { allow: HARD_DELETE_ALLOW }],
        // Env vars go through the zod schema (lib/env.server.ts), so an empty
        // value in Vercel reads the same everywhere.
        'pts/env-through-schema': 'error',
        ...(sheetRegistry && {
          'pts/sheet-url-through-builders': [
            'error',
            { entities: sheetParamNames(dir, sheetRegistry) },
          ],
        }),
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Literal[value=/(^|[\\s:])[a-z-]*-entity-[a-z]/]',
            message: entityColourMessage,
          },
          {
            selector:
              'TemplateElement[value.raw=/(^|[\\s:])[a-z-]*-entity-[a-z]/]',
            message: entityColourMessage,
          },
        ],
      },
    },
    ...(entityRegistry
      ? [{ files: [entityRegistry], rules: { 'no-restricted-syntax': 'off' } }]
      : []),
    { files: ENV_READERS, rules: { 'pts/env-through-schema': 'off' } },
    {
      // The sheet links' own home, and the proxy's mapping of retired params.
      files: ['lib/sheets/**', 'lib/projects/board/board-utils.ts', 'proxy.ts'],
      rules: { 'pts/sheet-url-through-builders': 'off' },
    },
    {
      // README → Color exceptions: the sidebar's dev band, previews that
      // mimic Gmail and Google Chat, and the generated share image.
      files: [
        'components/layout/sidebar.tsx',
        'app/(dashboard)/settings/templates/_components/**',
        '**/opengraph-image.tsx',
      ],
      rules: { 'pts/no-raw-colour': 'off' },
    },
    {
      // The design system's house rules (docs/design-system/README.md,
      // "House rules (verified in code)"); each message quotes its rule.
      rules: HOUSE_RULES,
    },
    {
      // README → Type: the shared invoice is a brand-ground page with its own
      // display sizes.
      files: ['app/*/share/**'],
      rules: { 'pts/no-raw-type-size': 'off' },
    },
    {
      // WCAG checks: eslint-config-next loads jsx-a11y but sets six of its
      // rules to warn; the whole recommended set fails instead.
      files: ['**/*.tsx'],
      rules: {
        ...jsxA11y.flatConfigs.recommended.rules,
        // `role` on our own components (RoleBadge) is a prop, not ARIA.
        'jsx-a11y/aria-role': ['error', { ignoreNonDOM: true }],
      },
    },
    {
      // Pages, layouts and components read data through lib/data (or a
      // lib/queries function), never the database client or schema directly.
      files: ['app/**/page.tsx', 'app/**/layout.tsx', 'components/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              ...restrictedImports,
              ...[
                '@/lib/db',
                '@/lib/db/schema',
                '@pts/db/schema',
                'drizzle-orm',
              ].map(name => ({
                name,
                message:
                  'Pages and components read data through lib/data or a lib/queries function, never the database directly.',
              })),
            ],
          },
        ],
      },
    },
    ...(pagePanel
      ? [
          {
            // README → Borders: page panels are <PagePanel> (this path).
            rules: { 'pts/one-page-panel': 'error' },
          },
          { files: [pagePanel], rules: { 'pts/one-page-panel': 'off' } },
        ]
      : []),
    ...typed({ dir }),
    {
      // Dev scripts print their output and clean up the rows they made.
      files: ['scripts/**'],
      rules: { 'no-console': 'off', 'pts/no-hard-delete': 'off' },
    },
    {
      // Layering: no server code in a 'use client' file.
      rules: { 'pts/client-boundary': ['error', { appDir: dir }] },
    },
    IGNORES,
  ]
}
