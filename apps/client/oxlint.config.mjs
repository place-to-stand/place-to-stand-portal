import { nextApp } from '@pts/lint-config/next'
import { toOxlint } from '@pts/lint-config/to-oxlint'

// Shared with apps/internal: packages/lint-config/next.mjs. The client
// portal has no entity registry, so entity colour classes are banned outright.
export default toOxlint(nextApp({ dir: import.meta.dirname, portal: 'client' }))
