/**
 * The rule sets our lint config starts from, as plain data: the ESLint
 * presets of typescript-eslint 8.72.0, eslint-config-next 16.4.3,
 * eslint-plugin-jsx-a11y 6.10.2 and eslint-plugin-react-hooks 7.1.1,
 * captured once. `env` stands for the browser and Node globals
 * eslint-config-next declared (`globals.browser` and `globals.node`). Rule
 * names stay in ESLint form; to-oxlint.mjs maps them. Change a rule in
 * base.mjs or next.mjs, not here. The data is in presets.json.
 */
import presets from './presets.json' with { type: 'json' }

export const {
  tsRecommended,
  nextCoreWebVitals,
  nextTypescript,
  jsxA11yRecommended,
  reactHooksRecommended,
} = presets
