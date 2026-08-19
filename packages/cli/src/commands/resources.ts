import type { Command } from 'commander'

import { apiGet } from '../client.js'
import { emit } from '../output.js'

type ListOptions = { search?: string; limit?: string }
type ProjectScopedOptions = { project: string; limit?: string }

/**
 * Listings that differ only by name and path — optional search, capped limit.
 * Registered from a description rather than repeated four times.
 */
const SIMPLE_LISTS = [
  { name: 'clients', description: 'Read clients', path: 'api/cli/v1/clients' },
  {
    name: 'contacts',
    description: 'Read contacts',
    path: 'api/cli/v1/contacts',
  },
  {
    name: 'invoices',
    description: 'Read invoices',
    path: 'api/cli/v1/invoices',
  },
] as const

function addListCommand(parent: Command, path: string, label: string): void {
  parent
    .command('list', { isDefault: true })
    .description(`List ${label}`)
    .option('--search <text>', 'Filter by name')
    .option('--limit <count>', 'Maximum rows (default 50, max 200)')
    .action(async (options: ListOptions) => {
      const { data } = await apiGet(path, {
        search: options.search,
        limit: options.limit,
      })

      emit(data)
    })
}

function registerProjects(program: Command): void {
  const projects = program.command('projects').description('Read projects')

  addListCommand(projects, 'api/cli/v1/projects', 'projects')

  projects
    .command('show <identifier>')
    .description('Show one project by UUID or slug')
    .action(async (identifier: string) => {
      const { data } = await apiGet(`api/cli/v1/projects/${identifier}`)

      emit(data)
    })
}

function registerUsers(program: Command): void {
  const users = program.command('users').description('Read users')

  users
    .command('list', { isDefault: true })
    .description('List active users')
    .option('--search <text>', 'Filter by name or email')
    .option('--role <role>', 'ADMIN or CLIENT')
    .option('--limit <count>', 'Maximum rows (default 50, max 200)')
    .action(async (options: { search?: string; role?: string; limit?: string }) => {
      const { data } = await apiGet('api/cli/v1/users', {
        search: options.search,
        role: options.role,
        limit: options.limit,
      })

      emit(data)
    })
}

function registerTime(program: Command): void {
  const time = program.command('time').description('Read logged time')

  time
    .command('list', { isDefault: true })
    .description('List time logs for a project')
    .requiredOption('--project <ref>', 'Project UUID or slug')
    .option('--limit <count>', 'Maximum rows (default 50, max 200)')
    .action(async (options: ProjectScopedOptions) => {
      const { data } = await apiGet('api/cli/v1/time-logs', {
        project: options.project,
        limit: options.limit,
      })

      emit(data)
    })
}

function registerSchema(program: Command): void {
  const schema = program
    .command('schema')
    .description('Inspect the database schema')

  schema
    .command('tables', { isDefault: true })
    .description('List tables and enums')
    .action(async () => {
      const { data } = await apiGet('api/cli/v1/schema')

      emit(data)
    })

  schema
    .command('describe <table>')
    .description('Show a table’s columns and foreign keys')
    .action(async (table: string) => {
      const { data } = await apiGet(`api/cli/v1/schema/${table}`)

      emit(data)
    })
}

export function registerResourceCommands(program: Command): void {
  registerProjects(program)

  for (const resource of SIMPLE_LISTS) {
    const command = program
      .command(resource.name)
      .description(resource.description)

    addListCommand(command, resource.path, resource.name)
  }

  registerUsers(program)
  registerTime(program)
  registerSchema(program)
}
