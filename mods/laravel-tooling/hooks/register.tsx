import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CheckName, CheckResult, Checks, Issue } from '../types'
import { parsePhpstan, parsePint, parseTests } from './parse'

const PANE = 'laravel-tooling'
const PROGRESS_EVERY = 500

const idle = (summary: string): CheckResult => ({ status: 'idle', summary, issues: [], durationMs: 0, ranAt: 0 })

const checks = atom({ plugin: 'laravel-tooling', key: 'checks' } as const, {
  pint: idle('not run yet'),
  phpstan: idle('not run yet'),
  tests: idle('run from the pane or /laravel-tooling tests'),
} satisfies Checks)
const pending = atom({ plugin: 'laravel-tooling', key: 'pending' } as const, [] as string[])

const LABELS: Record<CheckName, string> = { pint: 'Pint', phpstan: 'Larastan', tests: 'Tests' }
const SHORT: Record<CheckName, string> = { pint: 'Pint', phpstan: 'Stan', tests: 'Tests' }
const ORDER: CheckName[] = ['pint', 'phpstan', 'tests']

const ICONS: Record<CheckResult['status'], string> = { idle: '○', running: '◐', pass: '✓', fail: '✗', error: '!' }
const COLORS: Record<CheckResult['status'], string> = {
  idle: 'inactive',
  running: 'suggestion',
  pass: 'success',
  fail: 'error',
  error: 'warning',
}

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit'])

const settings = { autoTests: false, testFilter: '' }
const session = { root: '', isLaravel: false, phpstanConfig: undefined as string | undefined }
const runner = { isRunning: false, queued: undefined as CheckName[] | undefined, queuedFilter: '' }

const seconds = (ms: number): string => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)

const clock = (at: number): string => {
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const statusLine = (all: Checks): string =>
  ORDER.map(name => {
    const check = all[name]
    if (name === 'tests' && check.status === 'pass') {
      return `${SHORT[name]} ${check.summary.split(' ')[0]}`
    }
    if (check.status === 'fail' && name === 'phpstan') {
      return `${SHORT[name]} ${check.issues.length}${ICONS.fail}`
    }

    return `${SHORT[name]} ${ICONS[check.status]}`
  }).join(' · ')

const commandFor = (name: CheckName, filter: string): string[] => {
  if (name === 'pint') {
    return ['vendor/bin/pint', '--dirty', '--format=json']
  }
  if (name === 'phpstan') {
    const config = session.phpstanConfig === undefined ? [] : [`--configuration=${session.phpstanConfig}`]

    return ['vendor/bin/phpstan', 'analyse', '--memory-limit=2G', ...config, '--error-format=json', '--no-progress']
  }

  return ['vendor/bin/pest', '--teamcity', ...(filter === '' ? [] : [`--filter=${filter}`])]
}

const parse = (name: CheckName, stdout: string, stderr: string) =>
  name === 'pint'
    ? parsePint(stdout, stderr, session.root)
    : name === 'phpstan'
      ? parsePhpstan(stdout, stderr, session.root)
      : parseTests(stdout, stderr)

const setCheck = async ($: EngineInterface, name: CheckName, result: CheckResult): Promise<Checks> => {
  let after = await read($, checks)
  await update($, checks, all => {
    after = { ...all, [name]: result }

    return after
  })
  $.ui.status(statusLine(after))

  return after
}

const progressOf = (output: string): string => {
  const finished = output.split('##teamcity[testFinished').length - 1
  const failed = output.split('##teamcity[testFailed').length - 1

  return `running… ${finished} done${failed > 0 ? `, ${failed} failed` : ''}`
}

const capture = async (
  $: EngineInterface,
  argv: string[],
  onOutput: (stdout: string) => Promise<void>,
): Promise<{ stdout: string; stderr: string }> => {
  let stdout = ''
  let stderr = ''
  for await (const chunk of $.process.spawn({ argv, cwd: session.root, input: '' })) {
    if (chunk.stream === 'stdout') {
      stdout += chunk.text
      await onOutput(stdout)
    } else {
      stderr += chunk.text
    }
  }

  return { stdout, stderr }
}

const runOne = async ($: EngineInterface, name: CheckName, filter: string): Promise<void> => {
  const before = (await read($, checks))[name]
  const startedAt = await $.clock.now()
  const running: CheckResult = { ...before, status: 'running', summary: 'running…' }
  await setCheck($, name, running)

  let shownAt = startedAt
  const showProgress = async (stdout: string): Promise<void> => {
    const now = await $.clock.now()
    if (name !== 'tests' || now - shownAt < PROGRESS_EVERY) {
      return
    }
    shownAt = now
    await setCheck($, name, { ...running, summary: progressOf(stdout) })
  }

  let result: CheckResult
  try {
    const ran = await capture($, commandFor(name, filter), showProgress)
    result = { ...parse(name, ran.stdout, ran.stderr), durationMs: (await $.clock.now()) - startedAt, ranAt: startedAt }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    $.ui.log(`laravel-tooling: ${LABELS[name]} could not run: ${message}`, { to: 'debug' })
    result = {
      status: 'error',
      summary: 'could not run',
      issues: [{ file: '', message }],
      durationMs: (await $.clock.now()) - startedAt,
      ranAt: startedAt,
    }
  }

  await setCheck($, name, result)

  if (result.status === 'fail' && before.status !== 'fail') {
    $.ui.toast(`${LABELS[name]}: ${result.summary}`)
  }
}

const runChecks = async ($: EngineInterface, names: CheckName[], filter: string): Promise<void> => {
  if (runner.isRunning) {
    runner.queued = [...new Set([...(runner.queued ?? []), ...names])]
    runner.queuedFilter = filter

    return
  }

  runner.isRunning = true
  try {
    for (const name of ORDER.filter(one => names.includes(one))) {
      await runOne($, name, filter)
    }
  } finally {
    runner.isRunning = false
  }

  const next = runner.queued
  if (next !== undefined) {
    runner.queued = undefined
    await runChecks($, next, runner.queuedFilter)
  }
}

const start = ($: EngineInterface, names: CheckName[], filter = settings.testFilter): void => {
  $.clock.after(0, () => {
    void runChecks($, names, filter)
  })
}

const fixPrompt = (all: Checks): string => {
  const sections = ORDER.filter(name => all[name].status === 'fail' || all[name].status === 'error').map(name => {
    const lines = all[name].issues
      .slice(0, 40)
      .map(issue => `- ${issue.file}${issue.line === undefined ? '' : `:${issue.line}`} ${issue.message}`.trim())

    return `${LABELS[name]} (${all[name].summary}):\n${lines.join('\n')}`
  })

  return `Fix these Laravel tooling failures:\n\n${sections.join('\n\n')}\n`
}

const byFile = (issues: Issue[]): [string, Issue[]][] => {
  const groups = new Map<string, Issue[]>()
  for (const issue of issues) {
    groups.set(issue.file, [...(groups.get(issue.file) ?? []), issue])
  }

  return [...groups.entries()]
}

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Laravel tooling' })

export const register: Register = (on, options) => {
  settings.autoTests = options.autoTests === true
  settings.testFilter = String(options.testFilter ?? '').trim()

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    session.root = started.cwd
    const has = (path: string) => $.fs.exists(`${session.root}/${path}`)
    session.isLaravel = (await has('artisan')) && (await has('vendor/bin/pint'))
    if (!session.isLaravel) {
      return started
    }

    session.phpstanConfig = (await has('phpstan.neon'))
      ? 'phpstan.neon'
      : (await has('phpstan.neon.dist'))
        ? 'phpstan.neon.dist'
        : undefined

    try {
      await $.command.register({
        name: 'laravel-tooling',
        description: 'Laravel tooling: open the pane, `run` every check, or `tests [filter]` to run Pest',
        argumentHint: '[run | tests [filter] | pint | stan]',
      })
    } catch (error) {
      $.ui.log(`laravel-tooling: /laravel-tooling not registered: ${String(error)}`, { to: 'debug' })
    }
    $.ui.status(statusLine(await read($, checks)))

    return started
  })

  on('command.run', { command: 'laravel-tooling' }, async ($, e) => {
    if (!session.isLaravel) {
      return { text: 'This is not a Laravel project (no artisan and vendor/bin/pint).' }
    }

    const [action = '', ...rest] = e.args.trim().split(/\s+/)
    const filter = rest.join(' ')
    await openPane($)

    if (action === 'run') {
      start($, ORDER)

      return { text: 'Running Pint, Larastan and Pest.' }
    }
    if (action === 'tests') {
      start($, ['tests'], filter === '' ? settings.testFilter : filter)

      return { text: filter === '' ? 'Running Pest.' : `Running Pest with --filter=${filter}.` }
    }
    if (action === 'pint' || action === 'stan') {
      start($, [action === 'pint' ? 'pint' : 'phpstan'])

      return { text: `Running ${action === 'pint' ? 'Pint' : 'Larastan'}.` }
    }

    return { text: 'Laravel tooling pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (!session.isLaravel || !EDIT_TOOLS.has(String(e.tool)) || ran.isError === true) {
      return ran
    }

    const path = (e as { file_path?: unknown }).file_path
    if (typeof path === 'string' && path.endsWith('.php')) {
      await update($, pending, list => (list.includes(path) ? list : [...list, path]))
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!session.isLaravel || e.agentId !== undefined) {
      return done
    }

    const edited = await read($, pending)
    if (edited.length === 0) {
      return done
    }

    await update($, pending, () => [])
    start($, settings.autoTests ? ORDER : ['pint', 'phpstan'])

    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const all = await read($, checks)
    const width = e.props.bodyColumns ?? e.viewport?.columns ?? 80
    const room = Math.max(4, (e.viewport?.rows ?? 30) - 12)
    const hasFailures = ORDER.some(name => all[name].status === 'fail' || all[name].status === 'error')
    const isBusy = ORDER.some(name => all[name].status === 'running')
    const lastRan = Math.max(...ORDER.map(name => all[name].ranAt))
    let budget = room

    const issueRows = (name: CheckName) => {
      const issues = all[name].issues
      if (issues.length === 0 || budget <= 0) {
        return []
      }

      let shownCount = 0
      const rows = byFile(issues).flatMap(([file, list]) => {
        if (budget <= 0) {
          return []
        }
        budget -= 1
        const header =
          file === '' ? null : (
            <Box key={`${name}:${file}`} paddingLeft={4}>
              <Link href={`file://${session.root}/${file}`} label={file} />
            </Box>
          )
        const shown = list.slice(0, Math.max(0, budget))
        budget -= shown.length
        shownCount += shown.length

        return [
          header,
          ...shown.map((issue, index) => (
            <Box key={`${name}:${file}:${index}`} paddingLeft={file === '' ? 4 : 6} flexDirection="row" gap={1}>
              {issue.line !== undefined && (
                <Text color="warning">{String(issue.line).padStart(4)}</Text>
              )}
              <Text color="subtle" wrap="wrap">
                {issue.message}
              </Text>
            </Box>
          )),
        ]
      })
      const hidden = issues.length - shownCount

      return hidden > 0
        ? [
            ...rows,
            <Box key={`${name}:more`} paddingLeft={4}>
              <Text dimColor>…and {hidden} more</Text>
            </Box>,
          ]
        : rows
    }

    return (
      <Box flexDirection="column" width={width}>
        <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
          <Text bold color="claude">
            ⚒ Laravel tooling
          </Text>
          <Text dimColor>{lastRan > 0 ? `last run ${clock(lastRan)}` : 'waiting for PHP edits'}</Text>
        </Box>
        {ORDER.map(name => {
          const check = all[name]

          return (
            <Box key={name} flexDirection="column" marginBottom={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Box flexDirection="row" gap={1}>
                  <Text color={COLORS[check.status]} bold>
                    {ICONS[check.status]}
                  </Text>
                  <Text bold>{LABELS[name].padEnd(9)}</Text>
                  <Text color={check.status === 'idle' ? 'inactive' : COLORS[check.status]}>{check.summary}</Text>
                </Box>
                {check.durationMs > 0 && check.status !== 'running' && <Text dimColor>{seconds(check.durationMs)}</Text>}
              </Box>
              {issueRows(name)}
            </Box>
          )
        })}
        <Box flexDirection="row" gap={1}>
          <Button key="run" label={isBusy ? 'Running…' : 'Run all'} hotkey="r" variant="primary" onPress={() => start($, ORDER)} />
          <Button key="tests" label="Tests" hotkey="t" onPress={() => start($, ['tests'])} />
          {hasFailures && (
            <Button
              key="fix"
              label="Ask Claude to fix"
              hotkey="f"
              onPress={async () => {
                await $.prompt.fill({ text: fixPrompt(await read($, checks)), mode: 'replace' })
              }}
            />
          )}
        </Box>
      </Box>
    )
  })
}
