# Sheet

The right-side panel where every entity is created and edited, on Base UI Dialog. From `apps/internal/components/ui/sheet.tsx`.

**Look:** `bg-background shadow-lg border-l`, `w-3/4` capped by `size` (`sm` · `md` · `lg` · `xl` · `2xl` · `wide` sm:max-w-4xl lg:max-w-5xl · `xwide` · `full`); backdrop `bg-black/50`; slide in and out 300ms. `SheetHeader` is `bg-muted/50 p-4 gap-0.5`, `SheetTitle` font-semibold, `SheetDescription` text-sm muted; `SheetFooter` `mt-auto justify-end gap-3 p-4`. Close X top-right at 70% opacity.

**Header:** entity sheets use `SheetFormHeader` (`components/sheets/sheet-form-header.tsx`), not a hand-built `SheetHeader`: one compact title row (`p-2.5`, `text-base`) with its own close button (pass `hideCloseButton` to `SheetContent`) and a 2px bottom rule in the entity's accent color from `lib/entity-accents.ts` (task violet, lead amber, project emerald, client blue, contact cyan, invoice orange, hour block teal, user rose, submission pink, suggestion fuchsia, template slate). No eyebrow or description above the fold.

**Opening:** a sheet is addressed by one query param (`?task=<uuid>`, `?client=new`) through `useSheetParams`/`useSheetParamSelection` — never a route segment, never a hand-written URL; build links with `lib/sheets/hrefs.ts`. `open` comes from the hook's local mirror, not the raw param.

**Rules**
- Save is always enabled; disable only while saving or on a real validation failure. Never gate on `isDirty`.
- Save = done = close: a successful save closes the sheet, for create and edit alike. A create sheet never becomes an edit sheet.
- Controls inside the sheet bind to the form and apply in the save action — no immediate mutations from inside an edit sheet.
- Focus lands on the field marked `data-autofocus`, else the popup (not the close button).
- Presses inside toasts or other popups (select, dropdown) don't count as outside presses.
