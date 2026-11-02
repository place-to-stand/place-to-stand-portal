/**
 * Pre-commit (husky → lint-staged): fix and format only the staged files.
 * Fast on purpose: no type-check and no build here; CI runs those
 * (.github/workflows/ci.yml). Each file is linted inside its own workspace,
 * with that workspace's eslint.config.mjs and eslint-suppressions.json.
 */
export default {
  '{apps,packages}/**/*.{ts,tsx,mjs,js}': [
    // Per workspace, so each one's eslint-suppressions.json applies.
    'node scripts/lint-staged-eslint.mjs',
    'prettier --write --ignore-unknown',
  ],
  '{scripts,e2e}/**/*.{ts,mjs}': 'prettier --write --ignore-unknown',
  '*.{json,css}': 'prettier --write --ignore-unknown',
}
