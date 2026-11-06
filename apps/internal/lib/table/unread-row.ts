/**
 * An unread row (a submission nobody has acknowledged): a heavier weight
 * and a bar down its leading edge. The bar stays while the unread dot gives
 * way to the select box on hover, so the row still reads as unread.
 */
export const UNREAD_ROW_CLASS =
  'font-medium md:[&>td:first-child]:shadow-[inset_2px_0_0_var(--primary)] max-md:shadow-[inset_2px_0_0_var(--primary)]'
