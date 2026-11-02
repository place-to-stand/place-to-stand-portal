/**
 * Invoice money, worked out in whole cents so the numbers match what Postgres
 * stores (numeric with 2 decimals) to the cent. The server prices every save
 * with these; the browser's figures are only a preview.
 */

const toCents = (value: number) => Math.round(value * 100)

/** quantity × unit price, both at 2 decimals, rounded to the cent. */
export function lineItemCents(quantity: number, unitPrice: number): number {
  // Hundredths × hundredths = ten-thousandths; back to cents, half up.
  return Math.round((toCents(quantity) * toCents(unitPrice)) / 100)
}

export function centsToAmount(cents: number): number {
  return cents / 100
}

/** Subtotal, tax and total for line items and a tax rate as a decimal (0.0825). */
export function invoiceTotals(
  lineItems: Array<{ quantity: number; unitPrice: number }>,
  taxRateDecimal: number
) {
  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + lineItemCents(item.quantity, item.unitPrice),
    0
  )
  const taxCents = Math.round(subtotalCents * taxRateDecimal)
  return {
    subtotal: centsToAmount(subtotalCents),
    taxAmount: centsToAmount(taxCents),
    total: centsToAmount(subtotalCents + taxCents),
  }
}
