/**
 * Shared lint config for the two Next.js apps (apps/internal, apps/client),
 * so both portals get the same rules. Written in ESLint's flat format and
 * run by Oxlint (to-oxlint.mjs).
 *
 *   import { nextApp } from '@pts/lint-config/next'
 *   export default nextApp({ dir: import.meta.dirname, entityRegistry: 'lib/entity-accents.ts' })
 *
 * Options:
 * - `portal`: 'internal' or 'client', the word list pts/copy checks.
 * - `entityRegistry`: the app's entity registry (internal only). With it,
 *   entity icons from lucide-react are banned outside the registry; the
 *   `*-entity-*` colour classes are banned in every app either way.
 * - `sheetRegistry`: lib/sheets/entities.ts, whose params pts/sheets guards.
 * - `pagePanel`: the PagePanel component, the one place its classes live.
 * - `queryLayerAllowlist`: lib/queries files from before the layering rule.
 * - `apiRouteGuard`: API routes never call a redirecting guard.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  jsxA11yRecommended,
  nextCoreWebVitals,
  nextTypescript,
} from './presets.mjs'

import {
  FIXTURES,
  IGNORES,
  RAW_COLOUR_EXCEPTIONS,
  RESTRICTED_IMPORTS,
  common,
  typed,
} from './base.mjs'

import {
  API_ROUTE_GUARD,
  DIALOG_FORM,
  IMAGE_FILE_INPUT,
  NO_ALIGN_START,
  NO_HAND_SECTION_HEADING,
  NO_TITLE_TOOLTIP,
  SETTINGS_SUBMIT,
  TOOLTIP_OFF,
} from './syntax-rules.mjs'
import { appRestrictedPaths } from './app-imports.mjs'

export {
  API_ROUTE_GUARD,
  DIALOG_FORM,
  IMAGE_FILE_INPUT,
  NO_ALIGN_START,
  NO_HAND_SECTION_HEADING,
  NO_TITLE_TOOLTIP,
  SETTINGS_SUBMIT,
  TOOLTIP_OFF,
}

export const HOUSE_RULES = {
  'pts/save-not-gated-on-dirty': 'error', // rule 6
  'pts/archive-confirm': 'error', // one archive confirmation
  'pts/filter-select': 'error', // list filters are FilterSelect
  'pts/figure-cell-aligned': 'error', // table.md: figures right, tabular
  'pts/fixed-table-columns': 'error', // table.md: short columns fixed, text grows
}

/**
 * Where one check of a multi-check rule is off, by file (paths relative to
 * the app). Everything else gets every check.
 */
const CLASS_NAME_EXCEPTIONS = {
  // README → Color exceptions: the sidebar's dev band, previews that mimic
  // Gmail and Google Chat, and the generated share image.
  'raw-colour': [
    ...RAW_COLOUR_EXCEPTIONS,
    'components/layout/sidebar.tsx',
    'app/(dashboard)/settings/templates/_components/**',
    '**/opengraph-image.tsx',
  ],
  // README → Type: the shared invoice is a brand-ground page with its own
  // display sizes.
  'raw-type-size': ['app/*/share/**'],
}
const COPY_EXCEPTIONS = {
  // Machine-facing text (agents read `contact`) and the query layer.
  words: [
    'lib/queries/**',
    'lib/db/**',
    'lib/mcp/**',
    'lib/cli/**',
    'app/api/cli/**',
    'scripts/**',
    '**/*.test.*',
    '**/*.d.ts',
  ],
  // The vendored Tiptap editor keeps its own formatting; test fixtures
  // build raw payloads.
  figures: [
    '**/*.test.*',
    '**/tiptap*/**',
    '**/tiptap*.ts',
    'components/ui/rich-text-editor*',
    'components/ui/rich-text-editor/**',
  ],
}

/** What every app file is checked for with no-restricted-syntax. */
const RESTRICTED_SYNTAX = [NO_TITLE_TOOLTIP, TOOLTIP_OFF, NO_ALIGN_START]

/** lib/queries is "direct Drizzle queries, minimal business logic". */
export const QUERY_LAYER_PATTERNS = [
  {
    regex: '^@/lib/activity/(logger|events)(/|$)',
    allowTypeImports: true,
    message:
      'Layering (CLAUDE.md, "Data Layer Architecture"): lib/queries does no activity logging. Log in the server action or lib/<domain> service after the write.',
  },
  {
    regex: '^@/lib/auth/(permissions|capabilities|roles|session)$',
    allowTypeImports: true,
    message:
      'Layering (CLAUDE.md, "Data Layer Architecture"): lib/queries does no permission checks. Check permissions in the data layer (lib/data) or the server action that calls the query.',
  },
]

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
  // Tag join rows (lib/tags/server.ts): taking a tag off a record.
  'tagLinkTable',
  'companyTags',
  'company_tags',
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

export function nextApp({
  dir,
  portal,
  entityRegistry,
  sheetRegistry,
  pagePanel,
  queryLayerAllowlist,
  apiRouteGuard = false,
} = {}) {
  const restrictedPaths = appRestrictedPaths({
    dir,
    entityRegistry,
    sheetRegistry,
  })
  const internalSyntax = sheetRegistry
    ? [NO_HAND_SECTION_HEADING, DIALOG_FORM, IMAGE_FILE_INPUT]
    : []
  const restrictedImports = (paths, patterns = []) => [
    'error',
    { paths, patterns: [...RESTRICTED_IMPORTS.patterns, ...patterns] },
  ]

  const classNameExceptions = {
    ...CLASS_NAME_EXCEPTIONS,
    ...(entityRegistry && { 'entity-colour': [entityRegistry] }),
    ...(pagePanel && { 'page-panel': [pagePanel] }),
  }

  return [
    ...nextCoreWebVitals,
    ...nextTypescript,
    ...common(),
    {
      // Where the app's pages are (nextjs/no-html-link-for-pages).
      settings: { next: { rootDir: dir } },
      rules: {
        'no-restricted-imports': restrictedImports(restrictedPaths),
        // FormSection, PageForm and DialogForm live in the internal app
        // (the one with sheets).
        'no-restricted-syntax': [
          'error',
          ...RESTRICTED_SYNTAX,
          ...internalSyntax,
        ],
        // CLAUDE.md "Soft deletes": archive, never hard delete a record.
        'pts/no-hard-delete': ['error', { allow: HARD_DELETE_ALLOW }],
        // Env vars go through the zod schema (lib/env.server.ts), so an empty
        // value in Vercel reads the same everywhere.
        'pts/env-through-schema': 'error',
        // README rule 16: keyboard shortcuts come from lib/keyboard/shortcuts.
        'pts/shortcut-registry': 'error',
        // PR #365: element ids come from useId, so two sheets of one kind
        // never share one (internal app; older hits grandfathered).
        ...(sheetRegistry && { 'pts/use-id-not-fixed-id': 'error' }),
        'pts/class-names': [
          'error',
          {
            entities: entityRegistry ? 'registry' : 'none',
            pagePanel: Boolean(pagePanel),
            exceptions: classNameExceptions,
            root: dir,
          },
        ],
        'pts/copy': [
          'error',
          { portal, exceptions: COPY_EXCEPTIONS, root: dir },
        ],
        'pts/sheets': [
          'error',
          {
            ...(sheetRegistry && {
              entities: sheetParamNames(dir, sheetRegistry),
            }),
            root: dir,
            exceptions: {
              // The sheet links' own home, and the proxy's mapping of
              // retired params.
              'url-builders': [
                'lib/sheets/**',
                'lib/projects/board/board-utils.ts',
                'proxy.ts',
              ],
              // The stack's own readers, the proxy, and API routes, whose
              // query params are not sheets.
              'param-in-stack': ['lib/sheets/**', 'proxy.ts', 'app/api/**'],
              // Where sheetLayerZ is applied.
              'layer-z': ['components/ui/sheet.tsx'],
            },
          },
        ],
        // The design system's house rules (docs/design-system/README.md,
        // "House rules (verified in code)"); each message quotes its rule.
        ...HOUSE_RULES,
      },
    },
    { files: ENV_READERS, rules: { 'pts/env-through-schema': 'off' } },
    {
      // The registry's own matcher is the one place that reads the modifiers.
      files: ['lib/keyboard/**'],
      rules: { 'pts/shortcut-registry': 'off' },
    },
    {
      // One-of-a-kind pages: the sign-in forms and /design's section anchors
      // (its page nav links to them).
      files: ['app/(auth)/**', 'app/(dashboard)/design/**'],
      rules: { 'pts/use-id-not-fixed-id': 'off' },
    },
    {
      // WCAG checks: eslint-config-next loads jsx-a11y but sets six of its
      // rules to warn; the whole recommended set fails instead.
      files: ['**/*.tsx'],
      rules: {
        ...jsxA11yRecommended[0].rules,
        // `role` on our own components (RoleBadge) is a prop, not ARIA.
        'jsx-a11y/aria-role': ['error', { ignoreNonDOM: true }],
      },
    },
    {
      // Pages, layouts and components read data through lib/data (or a
      // lib/queries function), never the database client or schema directly.
      files: ['app/**/page.tsx', 'app/**/layout.tsx', 'components/**'],
      rules: {
        'no-restricted-imports': restrictedImports([
          ...restrictedPaths,
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
        ]),
      },
    },
    ...(queryLayerAllowlist
      ? [
          {
            // lib/queries does no logging and no permission checks. Files
            // from before the rule are listed in the app's config.
            files: ['lib/queries/**'],
            ignores: queryLayerAllowlist,
            rules: {
              'no-restricted-imports': restrictedImports(
                restrictedPaths,
                QUERY_LAYER_PATTERNS
              ),
            },
          },
        ]
      : []),
    ...(apiRouteGuard
      ? [
          {
            // API routes answer with 401/403 JSON (authorizeRoute), never a
            // redirect; OAuth navigations under app/api/auth may redirect.
            files: ['app/api/**/route.ts', 'app/api/**/route.tsx'],
            ignores: ['app/api/auth/**'],
            rules: {
              'no-restricted-syntax': [
                'error',
                ...RESTRICTED_SYNTAX,
                ...internalSyntax,
                API_ROUTE_GUARD,
              ],
            },
          },
        ]
      : []),
    ...(sheetRegistry
      ? [
          {
            // Settings pages save through PageForm's bar.
            files: ['app/(dashboard)/settings/**'],
            rules: {
              'no-restricted-syntax': [
                'error',
                ...RESTRICTED_SYNTAX,
                ...internalSyntax,
                SETTINGS_SUBMIT,
              ],
            },
          },
        ]
      : []),
    ...typed(),
    {
      // Dev scripts print their output and clean up the rows they made.
      files: ['scripts/**'],
      rules: { 'no-console': 'off', 'pts/no-hard-delete': 'off' },
    },
    {
      // Layering: no server code in a 'use client' file.
      rules: { 'pts/client-boundary': ['error', { appDir: dir }] },
    },
    FIXTURES,
    IGNORES,
  ]
}
