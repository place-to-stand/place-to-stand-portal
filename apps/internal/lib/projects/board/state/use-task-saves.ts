import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dispatch, SetStateAction } from 'react'

import { createTaskSaves } from './task-save-utils'
import type { TaskLookup } from './types'

/**
 * Saves a card's move on the project board, already shown. Moves overlap
 * (the board doesn't wait for a save), so:
 *
 * - one card's saves run one after another, so the database ends where the
 *   person last put the card, whatever order the network answers in;
 * - only the card's newest move settles it, wherever the board shows it by
 *   then (a refresh may have put it back meanwhile); an older move's answer
 *   leaves it alone;
 * - a refused move puts the card back where the last accepted save left it
 *   (not where it was when this move started, which may be a move that was
 *   itself refused), and only its status and rank, so other edits stay;
 *   then the board refreshes from the server.
 *
 * Resolves true when the save was accepted.
 */
export function useTaskSaves(
  setTasksByProject: Dispatch<SetStateAction<TaskLookup>>
) {
  const router = useRouter()
  const [save] = useState(() =>
    createTaskSaves(setTasksByProject, () => router.refresh())
  )
  return save
}
