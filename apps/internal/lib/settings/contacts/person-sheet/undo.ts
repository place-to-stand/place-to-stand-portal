/**
 * Steps a Save took outside its database transaction (Supabase Auth,
 * storage), undone newest first when the transaction fails.
 */
export class Undo {
  private steps: Array<() => Promise<void>> = []

  push(step: () => Promise<void>) {
    this.steps.push(step)
  }

  async run() {
    for (const step of this.steps.reverse()) {
      try {
        await step()
      } catch (error) {
        console.error('Failed to undo a step of a failed save', error)
      }
    }
    this.steps = []
  }
}
