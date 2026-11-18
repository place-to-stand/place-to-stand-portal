/**
 * no-restricted-syntax selectors (run as pts/restricted-syntax). next.mjs
 * applies them; each message quotes the house rule or design-system note it
 * enforces, and tests/configs.test.mjs covers each one.
 */

/**
 * House rule 11: a button takes a Tooltip, never title=. (RecordRowButton's
 * `title` is its row text, so only these names.)
 */
export const NO_TITLE_TOOLTIP = {
  selector:
    "JSXOpeningElement[name.name=/^(?:button|Button|\\w*IconButton|\\w*ActionButton)$/] > JSXAttribute[name.name='title']",
  message:
    'House rule 11 (docs/design-system/README.md): "Never title= as a tooltip." Use RowActionButton (label = tooltip + accessible name) or wrap the button in a Tooltip; use aria-label for the name.',
}

/**
 * House rule 11: RowActionButton's tooltip is off only where something else
 * explains the button: a menu or popover trigger, or its own Tooltip.
 */
export const TOOLTIP_OFF = {
  selector:
    "JSXOpeningElement[name.name='RowActionButton']:not(JSXElement[openingElement.name.name=/^(?:Tooltip|\\w*Trigger)$/] JSXOpeningElement) > JSXAttribute[name.name='tooltip'][value.expression.value=false]",
  message:
    'House rule 11 (docs/design-system/README.md): an icon-only button shows its label as a tooltip. tooltip={false} only on a menu or popover trigger, or inside its own Tooltip.',
}

/** House rule 4: popups are left-aligned by default, so align='start' is noise. */
export const NO_ALIGN_START = {
  selector:
    "JSXOpeningElement[name.name=/(?:Content|Positioner)$/] > JSXAttribute[name.name='align'][value.value='start']",
  message:
    "House rule 4 (docs/design-system/README.md): popups open left-aligned by default. Drop align='start'.",
}

/** API routes answer fetch callers, so they never call a redirecting guard. */
export const API_ROUTE_GUARD = {
  selector:
    'CallExpression[callee.name=/^(requirePage|requireUser|requireCrmUser)$/]',
  message:
    "This guard redirects, and an API route answers fetch calls: use `const { user, denied } = await authorizeRoute('<capability>'); if (denied) return denied` from @/lib/auth/guard. (OAuth navigations under app/api/auth may redirect.)",
}

/**
 * form-section.md: a page form's section heading is `FormSection`, never a
 * hand-written h2 with the heading classes.
 */
export const NO_HAND_SECTION_HEADING = {
  selector:
    "JSXOpeningElement[name.name='h2'] > JSXAttribute[name.name='className'][value.value=/\\btext-lg\\b/][value.value=/\\bfont-semibold\\b/]",
  message:
    "form-section.md (docs/design-system/components): a page form's section is `FormSection` from @/components/forms/form-section (title, description, action, the field grid), not a hand-written h2.",
}

/**
 * page-form.md: a dialog is portalled in the DOM but nested in React's tree,
 * so a plain <form> in it would submit the page or sheet behind it too.
 */
export const DIALOG_FORM = {
  selector:
    "JSXElement[openingElement.name.name=/^(Alert)?DialogContent$/] JSXOpeningElement[name.name='form']",
  message:
    "page-form.md (docs/design-system/components): a form inside a dialog is `DialogForm` from @/components/ui/dialog-form, which keeps its submit from reaching the page's or sheet's form.",
}

/** input.md: every image upload is the shared tile. */
export const IMAGE_FILE_INPUT = {
  selector:
    "JSXOpeningElement[name.name='input']:has(JSXAttribute[name.name='type'][value.value='file']):has(JSXAttribute[name.name='accept'][value.value=/image/])",
  message:
    'input.md (docs/design-system/components): an image upload is `ImageUploadControls` from @/components/forms/image-upload-controls (the photo, logo and icon tile), never a hand-made file input.',
}

/**
 * page-form.md: a Settings page saves through PageForm's save bar. A submit
 * button is only for a dialog's own form.
 */
export const SETTINGS_SUBMIT = {
  selector:
    "JSXOpeningElement[name.name='Button']:has(JSXAttribute[name.name='type'][value.value='submit']):not(JSXElement[openingElement.name.name=/^(?:DialogForm|DialogFooter)$/] JSXOpeningElement)",
  message:
    "page-form.md (docs/design-system/components): a Settings page saves through `PageForm` (@/components/layout/page-form) and its save bar, never a Save button of its own. Only a dialog's form (DialogForm / DialogFooter) has a submit button.",
}
