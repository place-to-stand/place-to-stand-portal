# RowActionButton

An icon-only action in a table row or toolbar. From `@pts/ui/row-action-button`.

**Look:** `Button` at `size='icon-sm'` (28px, 14px glyph), `ghost` by default (pass `variant='destructive'` for archive and delete), wrapped in a real `Tooltip`.

**Props:** `label` ("Archive client") becomes both the tooltip and the accessible name; `icon` is the lucide glyph; everything else passes to Button.

**Rules:** never `title=` on a Button as a tooltip (it's delayed, unstyled, and absent on touch). Labels are verb-first, sentence case.
