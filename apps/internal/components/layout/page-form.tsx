'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { Check, Redo2, Undo2 } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { RowActionButton } from '@pts/ui/row-action-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@pts/ui/tooltip'

import { ShortcutKeys } from '@/components/keyboard/shortcut-keys'
import { rowActionShortcut } from '@/components/keyboard/shortcut-tooltip'
import { Form } from '@/components/ui/form'
import { useConfirmLeavingPage } from '@/lib/hooks/use-confirm-leaving-page'
import { useSheetFormControls } from '@/lib/hooks/use-sheet-form-controls'
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import { ariaKeyShortcuts } from '@/lib/keyboard/format'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'
import { cn } from '@/lib/utils'

/** How long Save reads "Saved" after a save, as in a kept-open sheet. */
const SAVED_FOR_MS = 2000

type PageFormProps<TIn extends FieldValues, TOut> = {
  form: UseFormReturn<TIn, unknown, TOut>
  /**
   * Saves the values. Resolve true once saved (the caller resets the form to
   * them; no success toast, Save reads "Saved"); on failure show the "Unable to save …" toast, set field errors,
   * and resolve false.
   */
  onSave: (values: TOut) => Promise<boolean>
  /** Names the undo history ("business"), so two forms never share one. */
  historyKey: string
  /** Changes held outside react-hook-form (an image picked but not saved). */
  externalDirty?: boolean
  /** That outside state, so undo, redo and Discard step through it too. */
  getExternalState?: () => unknown
  applyExternalState?: (state: unknown) => void
  /** Discard: put the outside state back to what was saved. */
  onDiscard?: () => void
  className?: string
  children: ReactNode
}

/**
 * A form that is part of a page (Settings → Business, Billing's profit
 * share): it owns the unsaved-changes warning (reload, tab close, in-app
 * links, Back and Forward, the Ctrl K palette), ⌘S, undo and redo (the
 * sheets' history), and a save bar always pinned to the bottom of the page
 * column, as a sheet's footer is. Sheets and
 * dialogs keep their own footers.
 */
export function PageForm<TIn extends FieldValues, TOut>({
  form,
  onSave,
  historyKey,
  externalDirty = false,
  getExternalState,
  applyExternalState,
  onDiscard,
  className,
  children,
}: PageFormProps<TIn, TOut>) {
  // Awaited inside handleSubmit, so react-hook-form's isSubmitting is the
  // one pending flag: fields read it too (form.formState.isSubmitting).
  const isPending = form.formState.isSubmitting
  const [savedCount, setSavedCount] = useState(0)
  const [justSaved, setJustSaved] = useState(false)
  const isDirty = form.formState.isDirty || externalDirty

  // The history hook is typed for a form whose output is its input; it only
  // reads and writes the field values, which are TIn here too.
  const historyForm = form as unknown as UseFormReturn<TIn>

  const submit = useCallback(() => {
    void form.handleSubmit(async values => {
      if (await onSave(values)) {
        setJustSaved(true)
        setSavedCount(count => count + 1)
      }
    })()
  }, [form, onSave])

  const controls = useSheetFormControls<TIn>({
    form: historyForm,
    isActive: true,
    canSave: !isPending,
    onSave: submit,
    historyKey,
    getExternalState,
    applyExternalState,
  })
  const { rebaseline } = controls

  // A save starts the undo history again from what was saved.
  useEffect(() => {
    if (savedCount > 0) rebaseline()
  }, [rebaseline, savedCount])

  useEffect(() => {
    if (!justSaved) return
    const timer = setTimeout(() => setJustSaved(false), SAVED_FOR_MS)
    return () => clearTimeout(timer)
  }, [justSaved, savedCount])

  const { dialog, requestConfirmation } = useUnsavedChangesWarning({ isDirty })
  useConfirmLeavingPage(isDirty, requestConfirmation)

  const discard = () => {
    form.reset()
    onDiscard?.()
    rebaseline()
  }

  const saveLabel = isPending ? (
    'Saving...'
  ) : justSaved && !isDirty ? (
    <>
      <Check aria-hidden />
      Saved
    </>
  ) : (
    'Save'
  )

  return (
    <Form {...form}>
      <form
        onSubmit={event => {
          event.preventDefault()
          submit()
        }}
        className={cn('flex flex-col', className)}
      >
        {children}
        {/* The panel's own footer, always there like a sheet's: sticky to the
            bottom of the window while the form scrolls (the negative bottom
            cancels <main>'s padding, so nothing shows through below it),
            flush with the panel's edges and bottom radius, on the panel's
            surface, with one top border as the only divider. In flow, so
            the last field always ends above it. */}
        <div className='bg-background sticky -bottom-3 z-10 -mx-4 mt-6 -mb-4 flex items-center justify-between gap-2 rounded-b-xl border-t px-4 py-2.5 sm:-bottom-4'>
          <div className='flex items-center gap-1.5'>
            <RowActionButton
              type='button'
              variant='outline'
              onClick={controls.undo}
              disabled={!controls.canUndo}
              label='Undo'
              {...rowActionShortcut(SHORTCUTS.undo)}
              icon={<Undo2 />}
            />
            <RowActionButton
              type='button'
              variant='outline'
              onClick={controls.redo}
              disabled={!controls.canRedo}
              label='Redo'
              {...rowActionShortcut(SHORTCUTS.redo)}
              icon={<Redo2 />}
            />
          </div>
          <div className='flex items-center gap-1.5'>
            <span className='sr-only' aria-live='polite'>
              {justSaved ? 'Saved' : ''}
            </span>
            <Button
              type='button'
              variant='secondary'
              size='xs'
              disabled={isPending || !isDirty}
              onClick={discard}
            >
              Discard
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='submit'
                  size='xs'
                  disabled={isPending}
                  aria-keyshortcuts={ariaKeyShortcuts(SHORTCUTS.save)}
                >
                  {saveLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Save
                <span className='ml-2'>
                  <ShortcutKeys shortcut={SHORTCUTS.save} />
                </span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </form>
      {dialog}
    </Form>
  )
}
