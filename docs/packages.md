# Packages we publish

Some packages in this monorepo are published to npm under `@placetostand`, so
the products we build for clients can install them like any other package. The
rest stay private to this repo.

| Package              | Published | What it is                                                             |
| -------------------- | --------- | ---------------------------------------------------------------------- |
| `@placetostand/ui`   | Yes       | Components and the Tailwind theme (`packages/ui`)                      |
| `@pts/portal-ui`     | No        | Our portals' own layer: brand, sign-in shell, status and entity colors |
| Every other `@pts/*` | No        | Database, email, PDF, GitHub, server, CLI and lint config              |

Published packages are public and MIT licensed, like this repo.

## The rule that keeps them clean

Nothing about Place To Stand or our portals goes in a published package: no
logo, business name, entity colors or portal statuses. Those live in
`@pts/portal-ui`, which layers on top of `@placetostand/ui`. If a component
needs to know about our portals, it belongs in `@pts/portal-ui` (or an app),
not `@placetostand/ui`.

## How the apps use them

Inside the monorepo, every package's `exports` point at its `src/` files, so the
apps compile the source directly and a change shows up at once, with no build
step. Publishing builds a separate `dist/` (below); the source `package.json`
never reaches npm.

## Changing a published package

Add a changeset to the pull request:

```sh
npx changeset
```

Pick the package and the size of the change:

- **patch**: a fix. Nothing changes for projects using it.
- **minor**: something new, such as a component or an option.
- **major**: anything that can break a project using it: a removed or renamed
  component, prop or export, a changed default, a token removed from the
  theme. Write how to upgrade in the changeset.

Then one plain sentence for the changelog. Commit the file it creates in
`.changeset/`.

The **Changeset** PR check fails a pull request that changes a published
package's shipped files without a changeset naming it. Tests, lint config and
tsconfig files don't count. For a change nobody installing the package would
notice (a dev dependency, say), put the line `Changeset: none` in the pull
request description instead.

## How a release happens

1. A pull request with a changeset merges to `main`.
2. The **Release packages** workflow (`.github/workflows/release.yml`) opens or
   updates a pull request titled "Release packages", with the new version
   numbers and changelog entries.
3. Merging that pull request runs the workflow again, which builds each
   package (`scripts/build-package.mjs`) and publishes any version npm doesn't
   have yet (`scripts/publish-packages.mjs`).

`npm run release -- --dry-run` builds and packs every published package
without publishing, to check what would go out.

The release pull request is opened by GitHub Actions, so the required checks
don't run on it. It only changes version numbers, changelogs and the
lockfile; an admin merges it past the checks.

## Setup (once)

- **Let Actions open pull requests:** repo Settings → Actions → General →
  "Allow GitHub Actions to create and approve pull requests".
- **First publish of a new package:** npm can only trust our workflow for a
  package that already exists. Create a granular access token on npmjs.com
  (publish rights on `@placetostand`), save it as the `NPM_TOKEN` repo secret,
  and merge the release pull request.
- **Then switch to trusted publishing:** on the package's page on npmjs.com,
  Settings → Trusted publishing → GitHub Actions, repository
  `place-to-stand/place-to-stand-portal`, workflow `release.yml`. After that,
  delete the `NPM_TOKEN` secret and the token: each release proves itself
  with GitHub's sign-in, and npm shows where it was built.

## Adding a package to publish

1. Make it publishable: no `"private": true`, a `description`, `license`,
   `repository` (with `directory`), React as a peer dependency, and exports
   that all point into `src/`.
2. Add a `tsconfig.build.json` like `packages/ui`'s, a `build:package` script (not `build`, so app builds skip it) running
   `node ../../scripts/build-package.mjs`, and the `prepublishOnly` guard.
3. Add its folder to `PUBLISHED` in `scripts/published-packages.mjs`.
4. Add a README written for someone outside this repo.
