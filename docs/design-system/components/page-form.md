# PageForm

`apps/internal/components/layout/page-form.tsx`

A form that is part of a page, not a sheet or dialog: Settings → Business, and Settings → Billing's Profit share. It wraps react-hook-form's `<form>` and gives the page what a sheet gives its form, from the same parts: the unsaved-changes warning, ⌘S, undo and redo (`useSheetFormControls`), and the sheet footer (`FormFooterBar`) as a save bar.

```tsx
const form = useForm<Input, unknown, Output>({ resolver, defaultValues })

const onSave = async (values: Output) => {
  const result = await saveThing(values)
  if (!result.ok) {
    // field errors with form.setError, then the failure toast
    toast({
      variant: 'destructive',
      title: 'Unable to save the thing',
      description: result.error,
    })
    return false
  }
  form.reset(form.getValues())
  router.refresh()
  return true
}

;<PageForm form={form} onSave={onSave} historyKey='thing'>
  <div className={`${FORM_SECTIONS_CLASS} max-w-3xl`}>
    <FormSection title='…'>…</FormSection>
  </div>
</PageForm>
```

State held outside react-hook-form (an image picked but not saved) joins in with `externalDirty`, `getExternalState` / `applyExternalState` (undo and redo) and `onDiscard`.

## Rules

- **A form on a page saves through `PageForm`.** No hand-made Save button under a page's fields; a sheet uses its footer and a dialog its own. Instant lists (Product catalog, Tax rates) are not forms and save as each row is edited. (guard: review)
- **The save bar is the sheet footer.** Both render `FormFooterBar` (`components/sheets/sheet-form-footer.tsx`): the same chrome, height and padding, outline `RowActionButton` Undo and Redo on the left, `xs` actions on the right (a sheet: Save, Save and close; a page: Discard, Save). Never restyle it for a page; PageForm only adds the position and the slide. (guard: review)
- **Full width, sliding in on the first edit.** Fixed to the bottom of the window across the page column (`<main>`, from the sidebar's edge to the window's, following the sidebar as it collapses), its row lined up with the panel's edges (`px-3 sm:px-4`), safe-area padding on phones, one row at every width. Hidden at rest; it slides up (translate and opacity, 200ms ease-out; no slide under reduced motion) on the first edit, stays while there are changes, while saving, for 2s of "✓ Saved", and while there is something to redo (undoing back to the saved values keeps it up: Redo enabled, Discard disabled, Save enabled), then slides away; Discard clears the redo history and slides it away. While it shows, the page column gets the bar's height added below its padding, so the whole panel, bottom edge and corners included, scrolls up above it. ⌘S still saves at rest. (guard: review)
- **Undo and redo on the left; Discard (secondary) and Save (primary) on the right, primary last.** Discard puts every field back to what was saved and is disabled with nothing to discard. Save is never disabled for having no changes, only while saving (house rule 6). (guard: lint `pts/save-not-gated-on-dirty`)
- **Saving reports like a kept-open sheet:** no success toast; Save reads "✓ Saved" for 2s. A failure is the usual "Unable to save …" toast, with each field's own error under it. (guard: review)
- **⌘S saves** (`SHORTCUTS.save`, listed as "Save; in a sheet, save and close"; ⇧⌘S does the same), ⌘Z and ⇧⌘Z step the history, the same keys as a sheet; a sheet opened over the page takes them while it is on top. (guard: lint `pts/shortcut-registry`)
- **Leaving with changes asks first** ("Discard changes?"): reloading or closing the tab, any in-app link (sidebar, breadcrumbs), the Ctrl K palette (the form is the page's discard guard, asked after open sheets) and the browser's Back and Forward (the Navigation API's `navigate` event; a browser without it leaves without asking). (guard: review)
