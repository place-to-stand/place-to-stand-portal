import { Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { DesignSection, Specimen } from './specimen'

const BUTTON_VARIANTS = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
] as const

const BUTTON_TEXT_SIZES = ['xs', 'sm', 'default', 'lg'] as const
const BUTTON_ICON_SIZES = ['icon-sm', 'icon', 'icon-lg'] as const

const BADGE_VARIANTS = [
  'default',
  'secondary',
  'destructive',
  'outline',
] as const

export function PrimitivesButtons() {
  return (
    <DesignSection
      id='buttons'
      title='Buttons & badges'
      description='Every Button variant × size plus disabled state, and all Badge variants.'
    >
      <Specimen label='Button variants' note='size=default'>
        {BUTTON_VARIANTS.map(variant => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Specimen>

      <Specimen label='Button sizes' note='variant=default'>
        {BUTTON_TEXT_SIZES.map(size => (
          <Button key={size} size={size}>
            {size}
          </Button>
        ))}
        {BUTTON_ICON_SIZES.map(size => (
          <Button key={size} size={size} aria-label={`${size} button`}>
            <Plus />
          </Button>
        ))}
      </Specimen>

      <Specimen label='Variants × sizes' className='flex-col items-start'>
        {BUTTON_VARIANTS.map(variant => (
          <div key={variant} className='flex flex-wrap items-center gap-3'>
            <span className='text-muted-foreground w-24 shrink-0 font-mono text-[11px]'>
              {variant}
            </span>
            {BUTTON_TEXT_SIZES.map(size => (
              <Button key={size} variant={variant} size={size}>
                {size}
              </Button>
            ))}
            <Button variant={variant} size='icon' aria-label='icon button'>
              <Plus />
            </Button>
          </div>
        ))}
      </Specimen>

      <Specimen label='Disabled'>
        {BUTTON_VARIANTS.map(variant => (
          <Button key={variant} variant={variant} disabled>
            {variant}
          </Button>
        ))}
      </Specimen>

      <Specimen label='Badge variants' note='always rounded-full'>
        {BADGE_VARIANTS.map(variant => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </Specimen>
    </DesignSection>
  )
}
