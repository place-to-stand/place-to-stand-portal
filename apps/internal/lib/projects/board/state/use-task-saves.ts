import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { createTaskSaves } from './task-save-utils'
import type { TaskLookup } from './types'

/**
 * Saves a card's move on the project board, already shown. Moves overlap
 * (the board doesn't wait for a save), so:
 *
 * - one card's saves run one after another, so the database ends where the
 *   person last put the card, whatever order the network answers in;
 * - an answer settles the card only while it still sits where this move put
 *   it: a newer move owns it, and its own save settles it;
 * - a refused move puts the card back where the last accepted save left it
 *   (not where it was when this move started, which may be a move that was
 *   itself refused), and only its status and rank, so other edits stay.
 *
 * Resolves true when the save was accepted.
 */
export function useTaskSaves(
  setTasksByProject: Dispatch<SetStateAction<TaskLookup>>
) {
  const [save] = useState(() => createTaskSaves(setTasksByProject))
  return save
}
