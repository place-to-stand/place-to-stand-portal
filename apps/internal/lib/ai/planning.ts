import 'server-only'

import { tool } from 'ai'
import { z } from 'zod'

import { getFileContents, searchRepoCode, type GitHubAuth } from '@/lib/github/client'

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
      ? `\n## Repository File Tree\n\`\`\`\n${repoTree.join('\n')}\n\`\`\`\n`
      : ''

  const descSection = taskDescription
    ? `\n## Task Description\n${taskDescription}\n`
    : ''

  return `You are an expert software architect generating an implementation plan for a codebase.

## Orientation
${treeSection}${descSection}
## Task: ${taskTitle}

---

## Before You Begin — Explore the Code

You have \`read_file\`, \`list_directory\`, and \`search_code\` tools. **Use them extensively before writing any plan or asking any questions.** Never guess at code structure, types, or patterns — always read the source.

Follow this exploration sequence:

1. **Read foundational files first** — Look for README, package.json, config files (e.g., next.config.ts, tsconfig.json), and any project instruction files (CLAUDE.md, AGENTS.md) to understand the stack, conventions, and architecture.
2. **Read files directly relevant to the task** — Using the file tree above and the task description, identify and read the source files that will be created or modified. Read their imports and dependencies too.
3. **Search for related patterns** — Use \`search_code\` to find how similar features are implemented, how relevant types/interfaces are used, and what conventions exist.

Spend your first several tool calls on exploration. A plan grounded in actual code is vastly more useful than one based on file names alone.

---

## Planning Instructions

After exploring the codebase, produce an implementation plan. Your plan is a living document that will be iterated on through feedback.

**If you need clarification:** Start with a "## Clarifying Questions" heading followed by numbered questions. These questions should demonstrate that you've read the code — reference specific files, types, or patterns you found. Do NOT include any plan content when asking clarifying questions. Once the user answers, generate the full plan.

**If the task is clear enough:** Skip questions and go straight to the plan.

Structure your plan with:
1. **Context** — Brief summary of what needs to be built and why
2. **Design Decisions** — Key choices with rationale (table format works well)
3. **Architecture Overview** — How the pieces fit together
4. **Implementation Phases** — Ordered steps, each with:
   - Files to create/modify
   - What changes are needed
   - Verification steps
5. **Critical Files Reference** — Quick lookup table

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

const searchCodeSchema = z.object({
  query: z.string().describe('Search query — function names, type names, import paths, or keywords (e.g., "createPlanningTools", "TaskStatus enum", "useSheetFormControls")'),
})

export function createPlanningTools(
  userId: string,
  owner: string,
  repo: string,
  auth?: GitHubAuth
) {
  return {
    read_file: tool({
      description:
        'Read the contents of a file from the repository. Use this to understand existing code patterns, types, schemas, and implementations.',
      inputSchema: readFileSchema,
      execute: async ({ path }: z.infer<typeof readFileSchema>) => {
        try {
          const result = await getFileContents(userId, owner, repo, path, undefined, auth)
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
          const result = await getFileContents(userId, owner, repo, path || '.', undefined, auth)
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

    search_code: tool({
      description:
        'Search for code patterns, identifiers, or keywords across the repository. Returns matching file paths with text fragments. Use this to find how things are implemented, where types are used, or what conventions exist.',
      inputSchema: searchCodeSchema,
      execute: async ({ query }: z.infer<typeof searchCodeSchema>) => {
        try {
          const results = await searchRepoCode(userId, owner, repo, query, auth)
          if (results.length === 0) {
            return `No results found for "${query}".`
          }
          return results
            .map(r => {
              const fragments = r.fragments.length > 0
                ? `\n${r.fragments.map(f => `  | ${f}`).join('\n')}`
                : ''
              return `${r.path}${fragments}`
            })
            .join('\n\n')
        } catch (error) {
          return `Error searching for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
    }),
  }
}
