import {
  NO_RLS_IMPORT,
  RAW_COLOUR_EXCEPTIONS,
  reactLibrary,
} from '@pts/eslint-config/base'

export default [
  ...reactLibrary({ dir: import.meta.dirname }),
  {
    // The primitives themselves: the tooltip and a submenu sit at their own
    // elevation, and the logo has its own display sizes.
    rules: {
      'pts/class-names': [
        'error',
        {
          exceptions: {
            'raw-colour': RAW_COLOUR_EXCEPTIONS,
            'popover-shadow': ['src/tooltip.tsx', 'src/context-menu.tsx'],
            'raw-type-size': ['src/brand.tsx'],
          },
        },
      ],
    },
  },
  {
    // The one module allowed to build date formatters (house rule 10).
    files: ['src/dates.ts'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-imports': ['error', { paths: [NO_RLS_IMPORT] }],
    },
  },
  {
    // The one module allowed to build number formatters.
    files: ['src/numbers.ts'],
    rules: { 'no-restricted-properties': 'off', 'pts/copy': 'off' },
  },
]
