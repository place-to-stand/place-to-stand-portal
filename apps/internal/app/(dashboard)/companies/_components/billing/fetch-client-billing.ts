import type { ClientWithClosers } from '@/lib/companies/billing/client-sheet-utils'

/** A billed (or formerly billed) company's billing record, for its sheet. */
export async function fetchClientBilling(
  companyId: string
): Promise<ClientWithClosers> {
  const response = await fetch(
    `/api/sheets/init?entity=client&id=${encodeURIComponent(companyId)}`
  )
  const result = (await response.json()) as
    | { ok: true; data: { client: ClientWithClosers | null } }
    | { ok: false; error?: string }
  if (!result.ok || !result.data.client) {
    throw new Error(result.ok ? 'Client not found' : result.error)
  }
  return result.data.client
}
