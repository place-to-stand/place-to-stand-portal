/**
 * Renders the hours widget's time-log list to a standalone HTML file against
 * the app's compiled CSS, so the design can be reviewed in a browser without
 * signing in to the dev server.
 *
 * Usage: npm run preview:time-logs -- <output.html>
 * Dev-only scratch tooling; not imported by the app.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as React from 'react'
import { renderToString } from 'react-dom/server'

import { TimeLogList } from '../components/dashboard/hours-widget/time-log-list'
import type { DashboardTimeLogEntry } from '../lib/dashboard/types'

const entry = (
  over: Partial<DashboardTimeLogEntry> & { id: string }
): DashboardTimeLogEntry => ({
  loggedOn: '2026-08-10',
  hours: 2.5,
  note: null,
  projectId: 'p1',
  projectName: 'Website Redesign',
  projectSlug: 'website-redesign',
  projectType: 'CLIENT',
  clientName: 'Acme Corp',
  clientSlug: 'acme-corp',
  taskTitles: ['Rebuild the burndown query'],
  ...over,
})

const items: DashboardTimeLogEntry[] = [
  entry({ id: '1', hours: 3.5 }),
  entry({
    id: '2',
    loggedOn: '2026-08-09',
    hours: 1.25,
    taskTitles: ['Fix invoice totals', 'Second task', 'Third task'],
  }),
  entry({
    id: '3',
    loggedOn: '2026-08-08',
    hours: 8,
    clientName: null,
    clientSlug: null,
    projectType: 'INTERNAL',
    projectName: 'Internal Tooling',
    taskTitles: [],
    note: 'Paired on the deploy pipeline and cleaned up stale workflows',
  }),
  entry({
    id: '4',
    loggedOn: '2026-08-07',
    hours: 0.5,
    clientName: 'A Client With A Rather Long Name Ltd',
    projectName: 'A Project Whose Name Also Runs Long',
    taskTitles: ['A task title that is long enough to need truncating here'],
  }),
  entry({
    id: '5',
    loggedOn: '2026-08-06',
    hours: 4,
    clientName: null,
    clientSlug: null,
    projectType: 'PERSONAL',
    projectName: 'Personal',
    taskTitles: ['Weekly planning'],
  }),
]

const body = renderToString(
  <TimeLogList
    items={items}
    totalCount={12}
    isLoadingMore={false}
    onLoadMore={() => {}}
    onOpenEntry={() => {}}
    openingEntryId={null}
    error={null}
  />
)

const cssDir = path.join(process.cwd(), '.next/static/chunks')
const css = fs
  .readdirSync(cssDir)
  .filter(file => file.endsWith('.css'))
  .map(file => fs.readFileSync(path.join(cssDir, file), 'utf8'))
  .join('\n')

// Mirrors the widget's own chrome so spacing reads the way it will in situ.
const card = (theme: string) => `
  <div class="${theme}" style="padding:24px;background:var(--background)">
    <section class="bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm" style="max-width:520px">
      <header class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 class="text-sm font-semibold">Monthly Hours Snapshot</h2>
        <p class="mr-1 text-xs font-medium whitespace-nowrap">August 2026</p>
      </header>
      <div class="flex flex-1 flex-col gap-3 px-4 py-3">
        <div class="grid grid-cols-3 gap-2">
          <div class="rounded-lg border px-3 py-2">
            <p class="text-muted-foreground text-[10px] leading-tight font-medium tracking-wide uppercase">My billable hours</p>
            <p class="text-foreground mt-0.5 text-xl leading-tight font-semibold tabular-nums">42.5</p>
          </div>
          <div class="rounded-lg border px-3 py-2 bg-muted/50">
            <p class="text-muted-foreground text-[10px] leading-tight font-medium tracking-wide uppercase">Total billable hours</p>
            <p class="text-foreground mt-0.5 text-xl leading-tight font-semibold tabular-nums">128</p>
          </div>
          <div class="rounded-lg border px-3 py-2 bg-muted/50">
            <p class="text-muted-foreground text-[10px] leading-tight font-medium tracking-wide uppercase">Hours prepaid</p>
            <p class="text-foreground mt-0.5 text-xl leading-tight font-semibold tabular-nums">160</p>
          </div>
        </div>
        ${body}
      </div>
    </section>
  </div>`

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Time log list preview</title>
<style>${css}</style>
<style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif}
.grid-2{display:grid;grid-template-columns:1fr 1fr;align-items:start}</style>
</head><body><div class="grid-2">${card('light')}${card('dark')}</div></body></html>`

const out = process.argv[2] ?? 'time-log-preview.html'
fs.writeFileSync(out, html)
console.log(`wrote ${out} (${html.length} bytes)`)
