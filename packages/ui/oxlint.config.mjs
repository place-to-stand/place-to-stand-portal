import {
  FIXTURES,
  NO_RLS_IMPORT,
  RAW_COLOUR_EXCEPTIONS,
  RESTRICTED_IMPORTS,
  RESTRICTED_PROPERTIES,
  reactLibrary,
} from '@pts/lint-config/base'
import { toOxlint } from '@pts/lint-config/to-oxlint'

export default toOxlint([
  ...reactLibrary({ dir: import.meta.dirname }),
  {
    // The primitives themselves: the tooltip and a submenu sit at their own
    // elevation.
    rules: {
      'pts/class-names': [
        'error',
        {
          exceptions: {
            'raw-colour': RAW_COLOUR_EXCEPTIONS,
            'popover-shadow': ['src/tooltip.tsx', 'src/context-menu.tsx'],
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
])
