import { nextApp } from '@pts/eslint-config/next'

// Shared with apps/internal: packages/eslint-config/next.mjs. The client
// portal has no entity registry, so entity colour classes are banned outright.
export default nextApp({ dir: import.meta.dirname })
