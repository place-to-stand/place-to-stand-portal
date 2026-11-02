'use client'

import * as React from 'react'

import { Button } from './button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog'

type ButtonVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: ButtonVariant
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'default',
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // While it fades out, keep showing what it opened with: a caller that
  // derives the copy from state it clears on close would otherwise flash
  // another action's words (Revert to draft turning into Mark as sent).
  const live = {
    title,
    description,
    confirmLabel,
    cancelLabel,
    confirmVariant,
  }
  const [shown, setShown] = React.useState(live)
  if (
    open &&
    (shown.title !== title ||
      shown.description !== description ||
      shown.confirmLabel !== confirmLabel ||
      shown.cancelLabel !== cancelLabel ||
      shown.confirmVariant !== confirmVariant)
  ) {
    setShown(live)
  }
  const content = open ? live : shown

  return (
    <AlertDialog
      open={open}
      onOpenChange={next => {
        if (!next) {
          onCancel()
        }
      }}
    >
      <AlertDialogContent onBackdropClick={onCancel}>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          {content.description ? (
            <AlertDialogDescription>
              {content.description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type='button' variant='outline' onClick={onCancel}>
            {content.cancelLabel}
          </Button>
          <Button
            type='button'
            variant={content.confirmVariant}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {content.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
