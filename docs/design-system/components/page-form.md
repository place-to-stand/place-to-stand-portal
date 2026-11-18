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

State held outside react-hook-form (an image picked but not saved) joins in with `externalDirty`, `getExternalState` / `applyExternalState` (undo and redo) and `onDiscard`. `alwaysShowBar` keeps Save up with nothing changed, for confirming first-run values (Business until it is saved once).

## Rules

- **A form on a page saves through `PageForm`.** No hand-made Save button under a page's fields; a sheet uses its footer and a dialog its own. Instant lists (Product catalog, Tax rates) are not forms and save as each row is edited. (guard: review)
- **The save bar shows only when there is something to say:** while the form has changes, while saving, and for 2s after a save. It pins to the bottom of the page column (`sticky`, inside the `PagePanel`, never over the sidebar), and sits under the last section when the form is shorter than the window. It is `SheetFooterBar`, the sheet footer's chrome. (guard: review)
- **Undo and redo on the left; Discard (secondary) and Save (primary) on the right, primary last.** Discard puts every field back to what was saved. Save is never disabled for having no changes, only while saving (house rule 6). (guard: lint `pts/save-not-gated-on-dirty`)
- **Saving reports like a kept-open sheet:** no success toast; Save reads "✓ Saved" for 2s. A failure is the usual "Unable to save …" toast, with each field's own error under it. (guard: review)
- **⌘S saves** (`SHORTCUTS.save`; ⇧⌘S does the same), ⌘Z and ⇧⌘Z step the history, the same keys as a sheet; a sheet opened over the page takes them while it is on top. (guard: lint `pts/shortcut-registry`)
- **Leaving with changes asks first** ("Discard changes?"): reloading or closing the tab, and any in-app link (sidebar, breadcrumbs). (guard: review)
