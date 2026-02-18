import 'server-only'

import { tool } from 'ai'
import { z } from 'zod'

import { getFileContents } from '@/lib/github/client'

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

export function buildPlanningSystemPrompt(
  taskTitle: string,
  taskDescription: string | null,
  repoTree: string[]
): string {
  const treeSection =
    repoTree.length > 0
      ? `\n\n## Repository Structure\n\`\`\`\n${repoTree.join('\n')}\n\`\`\``
      : ''

  const descSection = taskDescription
    ? `\n\n## Task Description\n${taskDescription}`
    : ''

  return `You are an expert software architect generating an implementation plan.

## Task: ${taskTitle}${descSection}${treeSection}

## Instructions

Create a detailed, actionable implementation plan for the task above. Your plan is a living document that will be iterated on through feedback.

If the task description is ambiguous, underspecified, or missing critical details needed to produce a good plan, start your response with a "## Clarifying Questions" heading followed by numbered questions. Do NOT include any plan content when asking clarifying questions — only questions. Once the user answers, generate the full plan incorporating their answers.

If the task is clear enough to plan immediately, skip questions and go straight to the plan.

Structure your plan with:
1. **Context** — Brief summary of what needs to be built and why
2. **Design Decisions** — Key choices with rationale (table format works well)
3. **Architecture Overview** — How the pieces fit together
4. **Implementation Phases** — Ordered steps, each with:
   - Files to create/modify
   - What changes are needed
   - Verification steps
5. **Critical Files Reference** — Quick lookup table

Use the available tools to read relevant source files from the repository when you need to understand existing patterns, types, or implementations. Read files proactively — don't guess at code structure.

Keep the plan concise but comprehensive. Focus on the "what" and "why", not boilerplate. Use markdown formatting.`
}

// ---------------------------------------------------------------------------
// Tool definitions for Claude tool use
// ---------------------------------------------------------------------------

const readFileSchema = z.object({
  path: z.string().describe('File path relative to repository root (e.g., "lib/db/schema.ts")'),
})

const listDirectorySchema = z.object({
  path: z.string().describe('Directory path relative to repository root (e.g., "lib/db" or "" for root)'),
})

export function createPlanningTools(
  userId: string,
  owner: string,
  repo: string,
  connectionId?: string
) {
  return {
    read_file: tool({
      description:
        'Read the contents of a file from the repository. Use this to understand existing code patterns, types, schemas, and implementations.',
      inputSchema: readFileSchema,
      execute: async ({ path }: z.infer<typeof readFileSchema>) => {
        try {
          const result = await getFileContents(userId, owner, repo, path, undefined, connectionId)
          if (result.type === 'dir') {
            return `"${path}" is a directory. Entries:\n${result.entries.map(e => `  ${e.type === 'dir' ? '\u{1F4C1}' : '\u{1F4C4}'} ${e.name}`).join('\n')}`
          }
          // Truncate very large files
          const content = result.content.length > 50000
            ? result.content.slice(0, 50000) + '\n\n... (truncated, file is ' + result.size + ' bytes)'
            : result.content
          return content
        } catch (error) {
          return `Error reading "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),

    list_directory: tool({
      description:
        'List the contents of a directory in the repository. Returns file and folder names.',
      inputSchema: listDirectorySchema,
      execute: async ({ path }: z.infer<typeof listDirectorySchema>) => {
        try {
          const result = await getFileContents(userId, owner, repo, path || '.', undefined, connectionId)
          if (result.type === 'file') {
            return `"${path}" is a file, not a directory.`
          }
          return result.entries
            .map(e => `${e.type === 'dir' ? '\u{1F4C1}' : '\u{1F4C4}'} ${e.name}${e.type === 'file' ? ` (${e.size}b)` : ''}`)
            .join('\n')
        } catch (error) {
          return `Error listing "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),
  }
}
