# PageForm

`apps/internal/components/layout/page-form.tsx`

A form that is part of a page, not a sheet or dialog: Settings → Business, and Settings → Billing's Profit share. It wraps react-hook-form's `<form>` and gives the page what a sheet gives its form, from the same parts: the unsaved-changes warning, ⌘S, undo and redo (`useSheetFormControls`), and a save bar.

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
- **The save bar is always there, as the panel's own footer.** Sticky to the bottom of the window while the form scrolls, flush with the `PagePanel`'s edges and bottom radius, on the panel's surface (opaque `bg-background`) with one top `border` as the only divider, never over the sidebar; in flow, so the last field always ends above it. One row at every width. Its controls are the sheet footer's: outline `RowActionButton` Undo and Redo on the left, `xs` Discard (secondary) and Save (primary) on the right, `px-4 py-2.5`. At rest Undo, Redo and Discard are disabled and Save is enabled. (guard: review)
- **Undo and redo on the left; Discard (secondary) and Save (primary) on the right, primary last.** Discard puts every field back to what was saved, and is disabled with nothing to discard. Save is never disabled for having no changes, only while saving (house rule 6). (guard: lint `pts/save-not-gated-on-dirty`)
- **Saving reports like a kept-open sheet:** no success toast; Save reads "✓ Saved" for 2s. A failure is the usual "Unable to save …" toast, with each field's own error under it. (guard: review)
- **⌘S saves** (`SHORTCUTS.save`, listed as "Save; in a sheet, save and close"; ⇧⌘S does the same), ⌘Z and ⇧⌘Z step the history, the same keys as a sheet; a sheet opened over the page takes them while it is on top. (guard: lint `pts/shortcut-registry`)
- **Leaving with changes asks first** ("Discard changes?"): reloading or closing the tab, any in-app link (sidebar, breadcrumbs), the Ctrl K palette (the form is the page's discard guard, asked after open sheets) and the browser's Back and Forward (the Navigation API's `navigate` event; a browser without it leaves without asking). (guard: review)
