'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Button } from '@pts/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { Input } from '@pts/ui/input'
import { Label } from '@pts/ui/label'
import { PROJECT_SPECIAL_SEGMENTS } from '@/lib/projects/board/board-utils'

import { createPersonalBoard } from '../actions/create-personal-board'

/** Starts a personal board (a PERSONAL project only its creator sees). */
export function NewPersonalBoardButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleOpenChange = (next: boolean) => {
    if (isPending) return
    setOpen(next)
    if (!next) {
      setName('')
      setError(null)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createPersonalBoard({ name })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.push(
        `/projects/${PROJECT_SPECIAL_SEGMENTS.PERSONAL}/${result.slug}/tasks`
      )
    })
  }

  return (
    <>
      <Button
        type='button'
        size='sm'
        className='gap-2'
        onClick={() => setOpen(true)}
      >
        <Plus className='h-4 w-4' />
        New personal board
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <DialogHeader>
              <DialogTitle>New personal board</DialogTitle>
              <DialogDescription>
                A task board only you can see.
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-2'>
              <Label htmlFor='personal-board-name'>Name</Label>
              <Input
                id='personal-board-name'
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder='My follow-ups'
                maxLength={120}
                autoFocus
                disabled={isPending}
              />
              {error ? (
                <p className='text-destructive text-sm'>{error}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isPending || !name.trim()}>
                {isPending ? 'Creating…' : 'Create board'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
