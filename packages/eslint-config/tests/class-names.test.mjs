import { describe, it } from 'node:test'

import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'

import { pts } from '../plugin.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const errors = (...ids) => ids.map(messageId => ({ messageId }))

tester.run('class-names', pts.rules['class-names'], {
  valid: [
    // Tokens and roles.
    "const c = 'bg-warning/10 text-destructive border-brand-lime/50'",
    "const c = 'text-red'", // not a palette step
    "const c = 'grid-cols-2 gap-500'",
    "const c = 'text-micro text-overline text-sm'",
    "const c = 'grid grid-cols-1 lg:grid-cols-2'",
    "const c = 'grid gap-2'",
    "const c = 'flex md:grid-cols-2'",
    "const c = 'data-active:bg-background'",
    // Entity classes and the page panel are only checked when asked.
    "const c = 'text-entity-company'",
    "const c = 'bg-background rounded-xl border p-4 shadow-sm'",
    {
      code: "const c = 'rounded-xl border p-4'",
      options: [{ pagePanel: true }],
    },
    {
      code: "const c = 'rounded-lg border shadow-sm'",
      options: [{ pagePanel: true }],
    },
    // A check that's off for this file.
    {
      code: "const c = 'border-amber-500'",
      filename: 'src/badge-tints.ts',
      options: [{ exceptions: { 'raw-colour': ['**/badge-tints.ts'] } }],
    },
    // Floating panels.
    "<PopoverContent className='w-80 p-0' />",
    "<SelectContent className='shadow-popover' />",
    "<Card className='shadow-lg' />",
    "<SheetContent className='shadow-lg' />",
    "<SheetPrimitive.Popup className='shadow-lg' />",
    // Sizes.
    "<Button size='sm' className='w-full' />",
    "<Avatar size='xs' className='shrink-0' />",
    "<Badge variant='secondary'>App</Badge>",
    "<Badge className='gap-1 shrink-0'>x</Badge>",
    // Underlines.
    "<a className='hover:underline'><span className='truncate-link'>x</span></a>",
    "<Link className='truncate-link hover:underline'>x</Link>",
    "<div className='truncate'>x</div>",
    "<span className='truncate'><a className='hover:underline'>x</a></span>",
  ],
  invalid: [
    {
      code: "const c = 'border-b border-amber-500/40'",
      errors: errors('raw-colour'),
    },
    { code: "const c = 'dark:text-red-300'", errors: errors('raw-colour') },
    { code: "const c = 'border-[#65a30d]/60'", errors: errors('raw-colour') },
    { code: 'const c = `px-2 ${x} bg-zinc-100`', errors: errors('raw-colour') },
    {
      code: "const c = 'text-[10px] font-semibold'",
      errors: errors('raw-type-size'),
    },
    {
      code: 'const c = `sm:text-[22px] ${x}`',
      errors: errors('raw-type-size'),
    },
    {
      code: "<div className='grid gap-4 lg:grid-cols-2' />",
      errors: errors('grid-phone-column'),
    },
    {
      code: "const c = 'data-[state=open]:opacity-100'",
      errors: errors('state-attribute'),
    },
    {
      code: "const c = 'text-entity-company'",
      options: [{ entities: 'registry' }],
      errors: errors('entity-registry'),
    },
    {
      code: 'const c = `hover:bg-entity-lead/10 ${x}`',
      options: [{ entities: 'none' }],
      errors: errors('entity-none'),
    },
    {
      code: "const c = 'bg-background rounded-xl border p-4 shadow-sm'",
      options: [{ pagePanel: true }],
      errors: errors('page-panel'),
    },
    {
      code: 'const c = `bg-card ${x} rounded-xl border shadow-sm`',
      options: [{ pagePanel: true }],
      errors: errors('page-panel'),
    },
    {
      code: "<PopoverContent className='w-96 shadow-2xl' />",
      errors: errors('popover-shadow'),
    },
    {
      code: "<MenuPopup className={cn('p-1', open && 'shadow-lg')} />",
      errors: errors('popover-shadow'),
    },
    { code: "<Button className='h-8' />", errors: errors('size-override') },
    {
      // Also a raw type size.
      code: "<Avatar className={cn('text-[9px]', x)} />",
      errors: 2,
    },
    {
      code: "<Badge className='uppercase text-sm'>x</Badge>",
      errors: errors('badge-override'),
    },
    {
      code: "<Link className='hover:text-foreground truncate hover:underline'>x</Link>",
      errors: errors('underline-clipped'),
    },
    {
      code: "<a className={cn('inline-flex hover:underline')}><Icon /><span className='truncate'>x</span></a>",
      errors: errors('underline-clipped'),
    },
  ],
})
