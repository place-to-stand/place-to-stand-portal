/**
 * The public page a client views and pays on. Live exactly while the invoice
 * is sent (or viewed, paid, void) — never for a draft.
 */
export function invoiceShareHref(shareToken: string): string {
  return `/share/invoices/${shareToken}`
}

/**
 * The same page for admins, by id and behind sign-in: works for a draft,
 * records no view, and shows no live payment form.
 */
export function invoicePreviewHref(invoiceId: string): string {
  return `/preview/invoices/${invoiceId}`
}
