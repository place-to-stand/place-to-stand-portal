---
name: design-system
description: The Place To Stand design system (colors, type, spacing, components, copy voice, house UI rules). Use for any UI, visual design, styling, layout, component, mockup, prototype, email or PDF template, or user-facing copy work in this repo, including design canvases and artifacts made for it.
---

# Design system

Before designing or changing anything visual in this repo, read `docs/design-system/README.md` in full. Then read only the notes in `docs/design-system/components/` for the components the task touches, and look values up in `docs/design-system/tokens.json` rather than guessing them.

## How to apply it

- **Reuse before you build.** Look for an existing component in `packages/ui/src` or `apps/internal/components` first, and use it even if that bends the design a little. Do not hand-roll a toggle, badge, search box, filter, sheet header or page frame the codebase already has.
- **Tokens, not literals.** Style through the semantic Tailwind tokens (`bg-background`, `text-muted-foreground`, `border`, `bg-accent`...). The only raw colors allowed are the documented exceptions (brand lime on dark grounds, email paper, the audience/status badge tints).
- **Follow the house rules** at the end of the README. They are verified against the code and have been corrected by the team before.
- **Mockups and artifacts outside the app** (canvases, HTML previews): match the tokens in `tokens.json` exactly: Geist for UI, Space Grotesk only for brand moments, Geist Mono for identifiers, the neutral gray theme, lime only on dark grounds.

## Keeping it true

The docs describe; the code decides. If you change a theme color, the radius, `BRAND` or `EMAIL_COLORS`, run `npm run design-tokens` from the repo root and commit `tokens.json` (root `npm run lint` fails when it is stale), then fill in the usage note for any token the script marks `TODO`. If you change a component's look or a house rule, update its note in `docs/design-system/` in the same change.
