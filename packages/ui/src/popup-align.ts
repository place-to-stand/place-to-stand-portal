/**
 * House rule 4 (docs/design-system/README.md): popups align with their
 * trigger's start edge, and that is the wrappers' default. A call site passes
 * `align` only to deviate, so 'start' is not a value it can write.
 */
export type PopupAlign = 'center' | 'end'
