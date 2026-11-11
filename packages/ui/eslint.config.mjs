import {
  FIXTURES,
  NO_RLS_IMPORT,
  RAW_COLOUR_EXCEPTIONS,
  RESTRICTED_IMPORTS,
  RESTRICTED_PROPERTIES,
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
          root: import.meta.dirname,
        },
      ],
    },
  },
  {
    // The one module allowed to build date formatters (house rule 10).
    files: ['src/dates.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...RESTRICTED_PROPERTIES.filter(p => p.property === 'NumberFormat'),
      ],
      'no-restricted-imports': [
        'error',
        { paths: [NO_RLS_IMPORT], patterns: RESTRICTED_IMPORTS.patterns },
      ],
    },
  },
  {
    // The one module allowed to build number formatters.
    files: ['src/numbers.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...RESTRICTED_PROPERTIES.filter(p => p.property !== 'NumberFormat'),
      ],
      'pts/copy': 'off',
    },
  },
  FIXTURES,
]
