# Changesets

A changeset says what a pull request changes in a package we publish to npm
(`@placetostand/*`), and how big the change is. Add one with:

    npx changeset

Pick the package, then **patch** (a fix), **minor** (something new) or
**major** (anything that breaks a project already using it), and write one
plain sentence for the package's changelog. Commit the file it creates.

Merging to main opens a "Release packages" pull request with the new version
numbers and changelogs. Merging that one publishes to npm. See
`docs/packages.md`.
