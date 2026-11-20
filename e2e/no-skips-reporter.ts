import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter'

/**
 * Fails the run when a test skips because the data it needs is missing. The
 * seed (`npm run test:e2e:seed`) holds everything every test needs, so such a
 * skip means a test or the seed broke, and would otherwise pass silently.
 * Skips for a missing E2E_* setting (for example E2E_WRITES) are allowed.
 */
export default class NoSkipsReporter implements Reporter {
  private skipped: string[] = []

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== 'skipped') return
    const reasons = test.annotations
      .filter(a => a.type === 'skip')
      .map(a => a.description ?? '')
    // No skip annotation: it did not run because an earlier test in its
    // serial group failed, which that failure already reports.
    if (reasons.length === 0) return
    if (reasons.some(r => r.includes('E2E_'))) return
    this.skipped.push(
      `${test.titlePath().slice(1).join(' › ')}: ${reasons.join('; ') || 'skipped'}`
    )
  }

  onEnd(result: FullResult) {
    if (!this.skipped.length) return
    console.error(`\n${this.skipped.length} test(s) skipped for missing data:`)
    for (const line of this.skipped) console.error(`  ${line}`)
    if (result.status === 'passed') return { status: 'failed' as const }
  }
}
