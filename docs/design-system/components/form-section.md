# FormSection

`apps/internal/components/forms/form-section.tsx`

A titled group on a full-page form: the Settings pages (Business, Billing). It is the page-sized sibling of `SheetSection` (`sheet.md`): a heading, an optional one-line description and an optional action on the title row, then the content.

```tsx
<div className={cn(FORM_SECTIONS_CLASS, 'max-w-3xl')}>
  <FormSection title='Address'>
    <FormItem className={FORM_FIELD_WIDE_CLASS}>…Street…</FormItem>
    <FormItem>…City…</FormItem>
    <FormItem>…State…</FormItem>
  </FormSection>
  <FormSection
    title='Tax rates'
    layout='block'
    action={
      <Button size='sm'>
        <Plus />
        Create tax rate
      </Button>
    }
  >
    <Table>…</Table>
  </FormSection>
</div>
```

## Rules

- **Every section on a page form is a `FormSection`.** Never a hand-written `h2` with the heading classes; in a sheet it is `SheetSection`. (guard: lint `pts/restricted-syntax`)
- **Fields sit in the two-column grid.** The default `layout='fields'` puts the children in a grid that is one column on phones and two from `sm`; a field that needs the full width (Street, a list of people) takes `FORM_FIELD_WIDE_CLASS`. A table, list or other single block uses `layout='block'`. (guard: review)
- **Sections stack 32px apart** in `FORM_SECTIONS_CLASS`. A form of fields caps its width at `max-w-3xl`; a page of tables doesn't. (guard: review)
- **The title names a real group** (Address, Profit share), never "Details" or "General". Copy that explains the whole section goes in `description`, one line, not under each field. (guard: review)
- **The action adds to the section** (Create product opens the row's dialog). A page form's Save is the PageForm save bar, never a button on a title row (page-form.md). (guard: review)
