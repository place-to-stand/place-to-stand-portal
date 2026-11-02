# RowActionButton

An icon-only action in a table row or toolbar. From `@pts/ui/row-action-button`.

**Look:** `Button` at `size='icon-sm'` (28px, 14px glyph), `ghost` by default (pass `variant='destructive'` for archive and delete), wrapped in a real `Tooltip`.

**Props:** `label` ("Archive client") becomes both the tooltip and the accessible name; `icon` is the lucide glyph; `size='icon'` (36px) only where it sits beside default-height controls (a month stepper, a toolbar group); everything else passes to Button.

**Rules:** never `title=` on a Button as a tooltip (it's delayed, unstyled, and absent on touch). Labels are verb-first, sentence case. (guard: eslint `pts/no-title-tooltip`)

Every icon-only action uses `RowActionButton` so it has a hover tooltip; never mix it with plain icon Buttons in one Actions cell. A `DisabledFieldTooltip` that explains a disabled action wraps the `RowActionButton` itself. The one exception is a menu or popover trigger (`render` or child of a `*Trigger`), which opens a labelled popup and keeps its `aria-label`. (guard: eslint `pts/icon-button-tooltip`)
