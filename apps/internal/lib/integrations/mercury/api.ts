/**
 * Thin client for the Mercury REST API, authenticated with the company's
 * read-only API token (MERCURY_API_TOKEN). Unlike Vercel/Supabase this is a
 * single shared connection: the bank balance is company data, not a person's.
 *
 * No `server-only` import: the August profit-share backfill script runs this
 * under tsx. Callers inside the app reach it through ./balance.ts, which is
 * server-only and reads the token from serverEnv.
 */

const MERCURY_API = 'https://api.mercury.com/api/v1'
const PAGE_LIMIT = 1000

export class MercuryApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'MercuryApiError'
  }
}

export type MercuryAccount = {
  id: string
  name: string
  kind: string
  status: string
  currentBalance: number
}

type MercuryTransaction = {
  id: string
  accountId: string
  amount: number
  status: string
  postedAt: string | null
}

async function mercuryFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${MERCURY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = `Mercury responded ${response.status}`
    try {
      const body = (await response.json()) as {
        errors?: { message?: string }
        message?: string
      }
      message = body.errors?.message ?? body.message ?? message
    } catch {
      // Body wasn't JSON; keep the status message.
    }
    throw new MercuryApiError(message, response.status)
  }

  return (await response.json()) as T
}

/** Active depository accounts (checking, savings). Credit accounts are not listed here. */
export async function fetchMercuryAccounts(
  token: string
): Promise<MercuryAccount[]> {
  const { accounts } = await mercuryFetch<{ accounts: MercuryAccount[] }>(
    token,
    `/accounts?limit=${PAGE_LIMIT}`
  )
  return accounts
    .filter(account => account.status === 'active')
    .map(account => ({
      id: account.id,
      name: account.name,
      kind: account.kind,
      status: account.status,
      currentBalance: account.currentBalance,
    }))
}

/**
 * Every settled transaction posted on or after `postedStart` (YYYY-MM-DD),
 * across all accounts, walking Mercury's cursor pagination to the end.
 */
async function fetchPostedTransactionsSince(
  token: string,
  postedStart: string
): Promise<MercuryTransaction[]> {
  const all: MercuryTransaction[] = []
  let cursor: string | undefined

  for (;;) {
    const params = new URLSearchParams({
      postedStart,
      status: 'sent',
      limit: String(PAGE_LIMIT),
      order: 'asc',
    })
    if (cursor) params.set('start_after', cursor)

    const page = await mercuryFetch<{
      transactions: MercuryTransaction[]
      page?: { nextPage?: string }
    }>(token, `/transactions?${params.toString()}`)

    all.push(...page.transactions)
    cursor = page.page?.nextPage
    if (!cursor || page.transactions.length === 0) break
  }

  return all
}

export type MercuryBalanceAt = {
  /** The instant the balance is taken at (exclusive upper bound), ISO UTC. */
  cutoff: string
  accounts: Array<{ id: string; name: string; balance: number }>
  balance: number
  fetchedAt: string
}

const round2 = (value: number): number => Math.round(value * 100) / 100

/**
 * The combined depository balance as it stood at `cutoff`: each account's
 * current (settled) balance minus every settled transaction that posted at or
 * after the cutoff. Pending transactions are not in the current balance, so
 * they are not backed out either. Transactions on non-depository accounts
 * (the Mercury credit card) are ignored — only their autopay transfer out of
 * checking moves the balance.
 */
export async function fetchMercuryBalanceAt(
  token: string,
  cutoff: Date
): Promise<MercuryBalanceAt> {
  const accounts = await fetchMercuryAccounts(token)
  const cutoffMs = cutoff.getTime()

  // postedStart is date-granular; start a day early and filter precisely.
  const postedStart = new Date(cutoffMs - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const transactions =
    cutoffMs < Date.now()
      ? await fetchPostedTransactionsSince(token, postedStart)
      : []

  const laterByAccount = new Map<string, number>()
  for (const txn of transactions) {
    if (!txn.postedAt || Date.parse(txn.postedAt) < cutoffMs) continue
    laterByAccount.set(
      txn.accountId,
      (laterByAccount.get(txn.accountId) ?? 0) + txn.amount
    )
  }

  const balances = accounts.map(account => ({
    id: account.id,
    name: account.name,
    balance: round2(
      account.currentBalance - (laterByAccount.get(account.id) ?? 0)
    ),
  }))

  return {
    cutoff: cutoff.toISOString(),
    accounts: balances,
    balance: round2(balances.reduce((sum, a) => sum + a.balance, 0)),
    fetchedAt: new Date().toISOString(),
  }
}
