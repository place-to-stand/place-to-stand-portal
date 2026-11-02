/** The save error when an assignee can't open the task's project. */
export function assigneeAccessError(names: readonly string[]): string {
  const list = names.join(', ')
  return names.length === 1
    ? `${list} isn't a member of this project. Add them to the project first.`
    : `${list} aren't members of this project. Add them to the project first.`
}
