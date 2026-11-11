/**
 * Shared flat config for every workspace (apps and packages).
 *
 *   import { base } from '@pts/eslint-config/base'
 *   export default base()
 *
 * The apps layer Next.js and the house rules on top (`./next.mjs`).
 */
import { globalIgnores } from 'eslint/config'
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

import { pts } from './plugin.mjs'

export const IGNORES = globalIgnores([
  '**/node_modules/**',
  '**/.next/**',
  '**/out/**',
  '**/build/**',
  '**/dist/**',
  '**/next-env.d.ts',
])

/** CLAUDE.md "NEVER": no Row Level Security policies in the schema. */
export const NO_RLS_IMPORT = {
  name: 'drizzle-orm/pg-core',
  importNames: ['pgPolicy'],
  message:
    'CLAUDE.md: this project never uses Row Level Security. Access control lives in the application layer.',
}

const DATES_MESSAGE =
  'House rule 10 (docs/design-system/README.md): "Dates go through @pts/ui/dates … Never toLocaleDateString, a bare Intl.DateTimeFormat, or date-fns format() in the UI." It formats in the ambient timezone (hydration errors, off-by-one dates). Use formatCalendarDate / formatRelativeTime, or add a helper to packages/ui/src/dates.ts.'

const NUMBERS_MESSAGE =
  'Content fundamentals (docs/design-system/README.md): hours, money and percentages are formatted only by @pts/ui/numbers (formatHours, formatCurrency, formatPercent). Need a variant? Add an option to packages/ui/src/numbers.ts.'

/**
 * Imports banned everywhere. The apps add their own (next.mjs); a config
 * that sets no-restricted-imports again must start from this list, since a
 * later setting replaces an earlier one.
 */
export const RESTRICTED_IMPORTS = {
  paths: [
    NO_RLS_IMPORT,
    // House rule 10: dates go through @pts/ui/dates.
    { name: 'date-fns/format', message: DATES_MESSAGE },
    {
      name: 'date-fns',
      importNames: ['format', 'lightFormat'],
      message: DATES_MESSAGE,
    },
    {
      name: 'date-fns-tz',
      importNames: ['formatInTimeZone'],
      message: DATES_MESSAGE,
    },
  ],
  patterns: [
    {
      // House rule 1: every primitive is @base-ui/react.
      regex: '^(@radix-ui/|radix-ui$)',
      message:
        'House rule 1 (docs/design-system/README.md): "Every primitive is @base-ui/react. Radix is gone." Import the @pts/ui wrapper instead.',
    },
  ],
}

/** Date and number formatters only @pts/ui/dates and numbers may build. */
const RESTRICTED_PROPERTIES = [
  { property: 'toLocaleDateString', message: DATES_MESSAGE },
  { property: 'toLocaleTimeString', message: DATES_MESSAGE },
  { object: 'Intl', property: 'DateTimeFormat', message: DATES_MESSAGE },
  { object: 'Intl', property: 'NumberFormat', message: NUMBERS_MESSAGE },
]

/**
 * README → Color's listed exceptions to raw colours: the badge tint source,
 * the Switch's on state, and the auth ground (always dark, so its error red
 * is raw on purpose; auth-shell.tsx explains). The apps add theirs.
 */
export const RAW_COLOUR_EXCEPTIONS = [
  '**/badge-tints.ts',
  '**/switch.tsx',
  '**/auth-shell.tsx',
]

/**
 * Rule tests quote banned classes and copy as fixtures. Goes last in a
 * config, after anything that sets these rules again.
 */
export const FIXTURES = {
  files: ['**/tests/**'],
  rules: { 'pts/class-names': 'off', 'pts/copy': 'off' },
}

/**
 * Rules for every workspace, apps and packages alike. `allowConsole` for
 * command-line code (the pts CLI); scripts/ and e2e/ are never linted as app
 * code.
 */
export function common({ allowConsole = false } = {}) {
  return [
    {
      // A disable or inline config that no longer does anything is an error,
      // so stale ones can't pile up.
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
        reportUnusedInlineConfigs: 'error',
      },
      plugins: { pts, '@eslint-community/eslint-comments': eslintComments },
      rules: {
        // Every eslint-disable says why: `// eslint-disable-next-line rule -- reason`.
        '@eslint-community/eslint-comments/require-description': 'error',
        // ...names the rules it turns off, and a block disable is closed again.
        '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
        '@eslint-community/eslint-comments/disable-enable-pair': [
          'error',
          { allowWholeFile: true },
        ],
        // Logs are for problems. Report events through PostHog or the activity
        // log; return results from the route.
        'no-console': allowConsole
          ? 'off'
          : ['error', { allow: ['warn', 'error'] }],
        // Money: an outer column in a correlated subquery binds to the inner
        // table (three past bugs). See rules/drizzle-qualified-subquery.mjs.
        'pts/drizzle-qualified-subquery': 'error',
        // Tailwind classes and copy follow the design system: see the list of
        // checks at the top of each rule. The apps pass more options.
        'pts/class-names': [
          'error',
          { exceptions: { 'raw-colour': RAW_COLOUR_EXCEPTIONS } },
        ],
        'pts/copy': 'error',
        'no-restricted-imports': ['error', RESTRICTED_IMPORTS],
        'no-restricted-properties': ['error', ...RESTRICTED_PROPERTIES],
      },
    },
    FIXTURES,
    {
      // AGENTS.md: "Files approaching 300 lines should be split by
      // responsibility." Files already over the limit are listed in each
      // workspace's eslint-suppressions.json (ESLint bulk suppressions); a
      // new one fails lint. Split a listed file and lint prunes its entry
      // (`eslint --prune-suppressions`). Tests and generated files are exempt.
      files: ['**/*.{ts,tsx,mts,mjs,js}'],
      ignores: [
        '**/*.test.*',
        '**/tests/**',
        '**/lib/supabase/types.ts', // generated by supabase gen types
        '**/brand-icon-assets.ts', // embedded base64 images
      ],
      rules: {
        'max-lines': [
          'error',
          { max: 300, skipBlankLines: true, skipComments: true },
        ],
      },
    },
  ]
}

/**
 * Type-aware rules for every workspace. They need the TypeScript program,
 * which is the slow part, so the list stays short and each rule catches a
 * class of real bug:
 * - an unawaited promise loses its error (`no-floating-promises`), and a
 *   promise passed where a boolean or a void callback goes is never awaited
 *   (`no-misused-promises`);
 * - `await` on something that isn't a promise, and throwing a non-Error;
 * - a deprecated API, caught before an upgrade removes it;
 * - a switch over a union must name every member: a `default` doesn't count,
 *   so a new member is a lint error, not a silent fall-through.
 * Existing hits are grandfathered in eslint-suppressions.json.
 */
export function typed({ dir = process.cwd() } = {}) {
  return [
    {
      files: ['**/*.{ts,tsx,mts}'],
      // Outside every tsconfig, so there's no program to check them with.
      ignores: ['scripts/**', '**/*.test.*', '*.config.ts'],
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir: dir },
      },
      rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/only-throw-error': 'error',
        '@typescript-eslint/no-deprecated': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
      },
    },
  ]
}

/** A package that isn't a Next app. */
export function base({ allowConsole = false, dir } = {}) {
  return [
    IGNORES,
    // The same TypeScript rules eslint-config-next/typescript gives the apps.
    ...tseslint.configs.recommended,
    ...common({ allowConsole }),
    ...typed({ dir }),
  ]
}

/**
 * A React component library that isn't a Next app (packages/ui): the same
 * hooks rules (React Compiler rules included) and accessibility rules the
 * apps' components get, without the Next and app-only house rules.
 */
export function reactLibrary({ dir } = {}) {
  return [
    ...base({ dir }),
    {
      files: ['**/*.{ts,tsx}'],
      ...reactHooks.configs.flat['recommended-latest'],
    },
    {
      files: ['**/*.tsx'],
      ...jsxA11y.flatConfigs.recommended,
    },
  ]
}
