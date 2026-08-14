/**
 * Origination option shapes, shared by the client and lead sheets.
 *
 * These live BESIDE the shared picker rather than in either sheet's state
 * module, so both call sites consume one definition. Mapping a sheet-local
 * option type into these at the call site would be exactly the translation
 * layer that lets two "identical" models drift apart (C8/C13).
 */

/** An admin user available as an internal origination partner or closer. */
export type PartnerUserOption = {
  id: string
  fullName: string | null
  email: string
}

/** An external contact available as a referrer. */
export type OriginationContactOption = {
  id: string
  name: string | null
  email: string
}

export type OriginationMode = 'internal' | 'external'
