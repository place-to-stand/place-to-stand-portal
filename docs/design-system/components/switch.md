# Switch

On/off controls: `Switch` for settings-style toggles and `Checkbox` for selection and form booleans. From `@pts/ui/switch` and `@pts/ui/checkbox`.

**Switch:** `rounded-full`, `h-[1.15rem] w-8` (`size="sm"`: `h-3.5 w-6`); checked track `emerald-500` (a fixed palette color, not a token), unchecked `bg-input` (dark `input/80`); thumb `size-4` `bg-background` (dark: `foreground` off, white on).

**Checkbox:** `size-4 rounded-[4px] border-input shadow-xs`; checked `bg-primary border-primary` with a 14px Check in `primary-foreground`.

**Rules:** pair each with a `Label`; state styles use Base UI's `data-checked`/`data-unchecked`. Inside a sheet, bind to the form and apply on Save; a toggle in a table row may apply instantly.
