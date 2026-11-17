import { ruleTester } from './tester.mjs'

import { pts } from '../plugin.mjs'

const tester = ruleTester()

tester.run('require-description', pts.rules['require-description'], {
  valid: [
    '// oxlint-disable-next-line no-console -- printing is the output\nconsole.log(1)',
    '// eslint-disable-next-line no-console -- an old-style comment\nconsole.log(1)',
    '/* oxlint-disable max-lines -- kept whole */\nconst a = 1',
    '// just a comment\nconst a = 1',
    // A comment that only mentions a directive is not one.
    '// see oxlint-disable docs\nconst a = 1',
  ],
  invalid: [
    {
      code: '// oxlint-disable-next-line no-console\nconsole.log(1)',
      errors: [{ messageId: 'missingDescription' }],
    },
    {
      code: '/* eslint-enable no-console */\nconst a = 1',
      errors: [{ messageId: 'missingDescription' }],
    },
    {
      code: 'const a = 1 // oxlint-disable-line no-console',
      errors: [{ messageId: 'missingDescription' }],
    },
  ],
})

tester.run('no-unlimited-disable', pts.rules['no-unlimited-disable'], {
  valid: [
    '// oxlint-disable-next-line no-console -- why\nconsole.log(1)',
    '/* oxlint-enable */\nconst a = 1',
  ],
  invalid: [
    {
      code: '// oxlint-disable-next-line -- why\nconsole.log(1)',
      errors: [{ messageId: 'unexpected' }],
    },
    {
      code: '/* eslint-disable */\nconst a = 1',
      errors: [{ messageId: 'unexpected' }],
    },
  ],
})

tester.run('disable-enable-pair', pts.rules['disable-enable-pair'], {
  valid: [
    {
      // Above the first line of code: the whole file, allowed.
      code: '/* oxlint-disable max-lines -- why */\nconst a = 1',
      options: [{ allowWholeFile: true }],
    },
    '/* oxlint-disable no-console -- why */\nconsole.log(1)\n/* oxlint-enable no-console -- why */',
    '/* oxlint-disable no-console, no-debugger -- why */\nconsole.log(1)\n/* oxlint-enable -- why */',
    // Line forms close themselves.
    'const a = 1\n// oxlint-disable-next-line no-console -- why\nconsole.log(1)',
  ],
  invalid: [
    {
      code: 'const a = 1\n/* oxlint-disable no-console -- why */\nconsole.log(1)',
      options: [{ allowWholeFile: true }],
      errors: [{ messageId: 'missingRulePair' }],
    },
    {
      code: '/* oxlint-disable max-lines -- why */\nconst a = 1',
      errors: [{ messageId: 'missingRulePair' }],
    },
    {
      code: 'const a = 1\n/* oxlint-disable no-console, no-debugger -- why */\nconsole.log(1)\n/* oxlint-enable no-console -- why */',
      errors: [{ messageId: 'missingRulePair' }],
    },
  ],
})

tester.run('restricted-syntax', pts.rules['restricted-syntax'], {
  valid: [
    {
      code: 'const a = 1',
      options: [{ selector: 'DebuggerStatement', message: 'no' }],
    },
  ],
  invalid: [
    {
      code: 'debugger',
      options: [{ selector: 'DebuggerStatement', message: 'No debugger.' }],
      errors: [{ message: 'No debugger.' }],
    },
    {
      // Two selectors on one node report twice, as ESLint did.
      code: 'debugger',
      options: [
        { selector: 'DebuggerStatement', message: 'one' },
        { selector: 'DebuggerStatement', message: 'two' },
      ],
      errors: [{ message: 'one' }, { message: 'two' }],
    },
  ],
})
