/**
 * Pre-commit (husky → lint-staged): fix and format only the staged files.
 * Fast on purpose: no type-check and no build here; CI runs those
 * (.github/workflows/ci.yml). Each file is linted with its own workspace's
 * eslint.config.mjs (config lookup from the file).
 */
export default {
  '{apps,packages}/**/*.{ts,tsx,mjs,js}': [
    'eslint --flag v10_config_lookup_from_file --fix --no-warn-ignored',
    'prettier --write --ignore-unknown',
  ],
  '{scripts,e2e}/**/*.{ts,mjs}': 'prettier --write --ignore-unknown',
  '*.{json,css}': 'prettier --write --ignore-unknown',
}
