import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { parsePhpstan, parsePint, parseTests } from '../hooks/parse'

const ROOT = '/work/app'
const COMMAND = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 160 } }

const PINT_FIXED = JSON.stringify({
  tool: 'pint',
  result: 'fixed',
  files: [{ path: `${ROOT}/app/Models/User.php`, fixers: ['braces_position', 'declare_strict_types'] }],
})

const STAN_FAILED = JSON.stringify({
  totals: { errors: 0, file_errors: 2 },
  files: {
    [`${ROOT}/app/Services/Quote.php`]: {
      errors: 2,
      messages: [
        { message: 'Access to an undefined property App\\Models\\Quote::$total.', line: 42 },
        { message: 'Method Quote::sum() should return float but returns int.', line: 57 },
      ],
    },
  },
  errors: [],
})

const PEST_OUTPUT = [
  "##teamcity[testSuiteStarted name='Tests\\Unit\\QuoteTest' locationHint='pest_qn://tests/Unit/QuoteTest.php' flowId='1']",
  "##teamcity[testStarted name='adds totals' locationHint='pest_qn://tests/Unit/QuoteTest.php::adds totals' flowId='1']",
  "##teamcity[testFinished name='adds totals' duration='3' flowId='1']",
  "##teamcity[testStarted name='rounds |'cents|'' locationHint='pest_qn://tests/Unit/QuoteTest.php::rounds' flowId='1']",
  "##teamcity[testFailed name='rounds |'cents|'' message='Failed asserting that 1 is identical to 2.' details='at tests/Unit/QuoteTest.php:14' flowId='1']",
  "##teamcity[testFinished name='rounds |'cents|'' duration='2' flowId='1']",
  "##teamcity[testSuiteFinished name='Tests\\Unit\\QuoteTest' flowId='1']",
].join('\n')

const laravelHost = (on: On, outputs: Record<string, string>) => {
  const ran: string[][] = []
  mock.store(on)
  const clock = mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'laravel-tooling' } }))
  on('ui.status', () => ({ value: undefined }))
  on('fs.exists', (_, e) => ({ value: !e.path.endsWith('.dist') }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('process.spawn', async function* (_, e) {
    ran.push([...e.argv])
    const tool = e.argv[0]?.split('/').pop() ?? ''
    yield { stream: 'stdout' as const, text: outputs[tool] ?? '' }

    return { value: { code: 0, signal: null } }
  })

  return { ran, clock }
}

test('reads Pint fixes as relative files', () => {
  const parsed = parsePint(PINT_FIXED, '', ROOT)

  expect(parsed.status).toBe('pass')
  expect(parsed.summary).toBe('fixed 1 file')
  expect(parsed.issues[0]?.file).toBe('app/Models/User.php')
})

test('reads Larastan errors with their lines', () => {
  const parsed = parsePhpstan(STAN_FAILED, '', ROOT)

  expect(parsed.status).toBe('fail')
  expect(parsed.summary).toBe('2 errors in 1 file')
  expect(parsed.issues[1]).toEqual({
    file: 'app/Services/Quote.php',
    line: 57,
    message: 'Method Quote::sum() should return float but returns int.',
  })
})

test('reads Pest teamcity output, unescaping names', () => {
  const parsed = parseTests(PEST_OUTPUT, '')

  expect(parsed.status).toBe('fail')
  expect(parsed.summary).toBe('1 failure, 1/2 passed')
  expect(parsed.issues[0]).toEqual({
    file: 'tests/Unit/QuoteTest.php',
    line: 14,
    message: "rounds 'cents': Failed asserting that 1 is identical to 2.",
  })
})

test('runs Pint and Larastan after a turn that edited PHP, and draws the failures', async ($, on) => {
  const { ran, clock } = laravelHost(on, { pint: PINT_FIXED, phpstan: STAN_FAILED })
  on('tool.call', () => ({ result: 'ok', text: 'edited' }))
  on('turn.complete', () => ({ text: 'done' }))

  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/app/Services/Quote.php`, old_string: 'a', new_string: 'b' } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't1' })
  await clock.settle()

  expect(ran.map(argv => argv[0])).toEqual(['vendor/bin/pint', 'vendor/bin/phpstan'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'laravel-tooling',
      surface,
      component: 'Pane',
      requestId: 'laravel-tooling',
      props: { title: 'Laravel tooling', bodyColumns: 100 } as never,
    })

    expect(await ui.find({ type: 'Text', text: /2 errors in 1 file/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /undefined property/ })).toBeDefined()
    expect(await ui.find({ key: 'fix' })).toBeDefined()
    await ui.unmount()
  }
})

test('leaves a turn without PHP edits alone', async ($, on) => {
  const { ran, clock } = laravelHost(on, {})
  on('tool.call', () => ({ result: 'ok', text: 'edited' }))
  on('turn.complete', () => ({ text: 'done' }))

  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/README.md`, old_string: 'a', new_string: 'b' } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't1' })
  await clock.settle()

  expect(ran).toEqual([])
})

test('/laravel-tooling tests passes the filter to Pest', async ($, on) => {
  const { ran, clock } = laravelHost(on, { pest: PEST_OUTPUT })

  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  const answer = await $.command.run({ command: 'laravel-tooling', args: 'tests Quote', ...COMMAND })
  await clock.settle()

  expect(answer.text).toBe('Running Pest with --filter=Quote.')
  expect(ran).toEqual([['vendor/bin/pest', '--teamcity', '--filter=Quote']])
})
