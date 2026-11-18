'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { BrandLockup } from './brand'

type BusinessBrand = { name: string; iconSrc: string | null }

const BusinessBrandContext = createContext<BusinessBrand | null>(null)

/**
 * The business's name and icon from Settings → Business, set once by each
 * app's root layout so screens outside the app shell (sign-in) show them.
 */
export function BusinessBrandProvider({
  brand,
  children,
}: {
  brand: BusinessBrand | null
  children: ReactNode
}) {
  return (
    <BusinessBrandContext.Provider value={brand}>
      {children}
    </BusinessBrandContext.Provider>
  )
}

/** `BrandLockup` with the business's name and icon, when the layout set them. */
export function BusinessBrandLockup({ label }: { label: string }) {
  const brand = useContext(BusinessBrandContext)
  return (
    <BrandLockup
      label={label}
      name={brand?.name}
      iconSrc={brand?.iconSrc ?? null}
    />
  )
}
