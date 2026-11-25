/**
 * The packages we publish to npm, by folder. Everything else in packages/
 * stays private. Read by scripts/publish-packages.mjs and the Changeset PR
 * check (scripts/pr-checks/changeset.mjs).
 */
export const PUBLISHED = ['packages/ui']
