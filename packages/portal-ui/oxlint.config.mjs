import {
  FIXTURES,
  RAW_COLOUR_EXCEPTIONS,
  reactLibrary,
} from '@pts/lint-config/base'
import { toOxlint } from '@pts/lint-config/to-oxlint'

export default toOxlint([
  ...reactLibrary({ dir: import.meta.dirname }),
  {
    // The logo has its own display sizes.
    rules: {
      'pts/class-names': [
        'error',
        {
          exceptions: {
            'raw-colour': RAW_COLOUR_EXCEPTIONS,
            'raw-type-size': ['src/brand.tsx'],
          },
          root: import.meta.dirname,
        },
      ],
    },
  },
  FIXTURES,
])
