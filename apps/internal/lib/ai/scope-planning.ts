import 'server-only'

const MAX_SOW_CHARS = 50_000

export function buildScopePlanningSystemPrompt(
  sowContent: string,
  projectName: string,
  repoTree: string[]
): string {
  const treeSection =
    repoTree.length > 0
      ? `\n## Repository File Tree\n\`\`\`\n${repoTree.join('\n')}\n\`\`\`\n`
      : ''

  const truncatedSow =
    sowContent.length > MAX_SOW_CHARS
      ? sowContent.slice(0, MAX_SOW_CHARS) +
        `\n\n... (truncated at ${MAX_SOW_CHARS} characters)`
      : sowContent

  return `You are an expert software architect creating a phased execution plan for a full Scope of Work (SOW).

## Project: ${projectName}

## Scope of Work Document

<sow>
${truncatedSow}
</sow>

## SOW Formatting Notes
Text marked with ~~strikethrough~~ indicates items already completed or out of scope.
- Treat ~~strikethrough text~~ as COMPLETED — do not plan tasks for these items
- If an entire section is struck through, note it as completed in your scope analysis
- Focus your plan on non-strikethrough items that still need implementation
${treeSection}

---

## Before You Begin — Explore the Code

You have \`read_file\`, \`list_directory\`, and \`search_code\` tools. **Use them extensively before writing any plan.** Never guess at code structure, types, or patterns — always read the source.

Follow this exploration sequence:

1. **Read foundational files first** — Look for README, package.json, config files (e.g., next.config.ts, tsconfig.json), and any project instruction files (CLAUDE.md, AGENTS.md) to understand the stack, conventions, and architecture.
2. **Understand the existing codebase** — Read files that are relevant to the SOW's scope. Follow imports and dependencies to build a mental model of the architecture.
3. **Search for existing patterns** — Use \`search_code\` to find how similar features are implemented, how relevant types/interfaces are used, and what conventions exist.
4. **Identify integration points** — Understand where the SOW's deliverables connect to the existing system.

Spend your first several tool calls on deep exploration. A plan grounded in actual code is vastly more useful than one based on assumptions.

---

## Planning Instructions

After exploring the codebase, produce a comprehensive phased execution plan. Your plan is a living document that will be iterated on through feedback.

**If you need clarification:** Start with a "## Clarifying Questions" heading followed by numbered questions. These questions should demonstrate that you've read the code — reference specific files, types, or patterns you found. Do NOT include any plan content when asking clarifying questions.

**If the scope is clear enough:** Skip questions and go straight to the plan.

Structure your plan as follows:

### 1. Scope Analysis
- Brief summary of the SOW deliverables
- Key technical requirements identified from the document
- Constraints, assumptions, and open questions

### 2. Phase Breakdown
For each phase:
- **Phase N: [Title]** — what this phase delivers
- **Dependencies:** What must be completed first
- **Tasks:**
  - Task name
  - Files to create/modify
  - Acceptance criteria
  - Estimated complexity (S/M/L)
- **Verification:** How to validate phase completion

### 3. Architecture Decisions
Key design choices with rationale. For each decision:
- What the decision is
- Alternatives considered
- Why this approach was chosen
- Trade-offs accepted

### 4. Critical Files Reference
Quick lookup table of the most important files that will be created or modified, organized by phase.

### Guidelines
- Group related tasks into coherent phases that can be developed and tested independently
- Order phases by dependency — earlier phases should not depend on later ones
- Be specific about files and code patterns — reference actual code you read
- Each phase should be deployable (or at minimum, buildable) on its own
- Focus on the "what" and "why", not boilerplate

Use markdown formatting throughout.`
}
