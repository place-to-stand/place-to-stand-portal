'use client'

import type { LucideIcon } from 'lucide-react'

import { MetaLink } from '@/components/ui/meta-link'

type AnchorRowProps = {
  icon: LucideIcon
  value: string
  href: string
}

/** A lead card's email or phone line: a link that doesn't open the card. */
export function AnchorRow({ icon: Icon, value, href }: AnchorRowProps) {
  return (
    <MetaLink
      href={href}
      onClick={event => event.stopPropagation()}
      title={value}
      icon={<Icon className='h-3.5 w-3.5 shrink-0' aria-hidden />}
    >
      {value}
    </MetaLink>
  )
}
