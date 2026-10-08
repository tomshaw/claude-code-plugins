import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

const COMMAND = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 160 } }
const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

const STAGED = 'diff --git a/app/Quote.php b/app/Quote.php\n+ return $total;\n'

const FULL_REPLY = JSON.stringify({
  subject: 'fix: return the quote total',
  body: ['Totals were computed but never returned, so', 'proposals showed zero.'],
  footer: ['Refs #690'],
})

type HostOptions = {
  staged?: string
  unstaged?: string
  unstagedStat?: string
  untracked?: Record<string, string>
  isPlaced?: boolean
  replies?: (string | null)[]
  fork?: string | 'aborted'
}

const gitHost = (on: On, options: HostOptions = {}) => {
  const prompts: string[] = []
  const systems: string[] = []
  const copied: string[] = []
  const commands: string[] = []
  const forks: string[] = []
  const replies = [...(options.replies ?? ['fix: return the quote total'])]
  const untracked = options.untracked ?? {}
  mock.store(on)
  const clock = mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'commit-msg' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () =>
    options.isPlaced === false
      ? { value: { isPlaced: false as const, reason: 'too narrow' } }
      : { value: { isPlaced: true as const } },
  )
  on('process.run', (_, e) => {
    const args = e.argv.slice(1).join(' ')
    commands.push(args)
    if (args.startsWith('diff --no-index')) {
      const file = e.argv[e.argv.length - 1] ?? ''

      return { value: { exitCode: 1, stdout: `+++ b/${file}\n${untracked[file] ?? ''}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (args.startsWith('diff HEAD --no-color')) {
      return ok(options.unstaged ?? '')
    }
    if (args.startsWith('diff HEAD --stat')) {
      return ok(options.unstagedStat ?? '')
    }
    if (args.startsWith('ls-files')) {
      return ok(Object.keys(untracked).join('\n'))
    }
    if (args.startsWith('diff --cached --no-color')) {
      return ok(options.staged ?? STAGED)
    }
    if (args.startsWith('diff --cached --stat')) {
      return ok(' app/Quote.php | 1 +\n')
    }
    if (args.startsWith('log')) {
      return ok('feat: add quotes #12\nfix: rounding in totals\n')
    }
    if (args.startsWith('rev-parse --abbrev-ref')) {
      return ok('master\n')
    }

    return ok(args.startsWith('rev-parse') ? 'true\n' : '')
  })
  on('model.complete', (_, e) => {
    prompts.push(e.prompt)
    systems.push(e.system ?? '')

    const reply = replies.length > 0 ? replies.shift() : 'fix: again'
    if (reply === null || reply === undefined) {
      return {
        value: { isAnswered: false as const, reason: 'api-error' as const, status: 529, error: 'overloaded' as const, usage },
      }
    }

    return { value: { isAnswered: true as const, text: reply, usage } }
  })
  on('model.fork', (_, e) => {
    forks.push(e.prompt)
    if (options.fork === 'aborted') {
      return { value: { isAnswered: false as const, reason: 'aborted' as const, usage } }
    }
    if (options.fork !== undefined) {
      return { value: { isAnswered: true as const, text: options.fork, usage } }
    }

    return { value: { isAnswered: false as const, reason: 'nothing-to-fork' as const } }
  })
  on('ui.copy', (_, e) => {
    copied.push(e.text)

    return { value: { isCopied: true as const } }
  })

  return { prompts, systems, copied, commands, forks, clock }
}

const mountPane = ($: Parameters<TestBody>[0], surface: 'terminal' | 'desktop', placement: 'dock' | 'inline' = 'inline') =>
  $.ui.mount({
    plugin: 'commit-msg',
    surface,
    component: 'Pane',
    requestId: 'commit-msg',
    props: { title: 'Commit message', bodyColumns: 100, placement } as never,
  })

const startSession = async ($: Parameters<TestBody>[0], args = '') => {
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...COMMAND, command: 'commit-msg', args })
}

test('writes a simple message in the pane and copies it', async ($, on) => {
  const { prompts, systems, copied, clock } = gitHost(on, { replies: ['```\nfix: return the quote total\n```'] })

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  const answer = await $.command.run({ ...COMMAND, command: 'commit-msg', args: '' })
  await clock.settle()

  expect(answer.text).toBe('Writing a simple commit message in the pane.')
  expect(prompts[0]).toContain('feat: add quotes #12')
  expect(prompts[0]).toContain(STAGED)
  expect(systems[0]).toContain('subject line only')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountPane($, surface)
    expect(await ui.find({ type: 'Text', text: /fix: return the quote total/ })).toBeDefined()
    await ui.press({ key: 'copy' })
    await ui.unmount()
  }

  expect(copied).toEqual(['fix: return the quote total', 'fix: return the quote total'])
})

test('writes body and footer for the full style', async ($, on) => {
  const { systems, copied, clock } = gitHost(on, { replies: [FULL_REPLY] })

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...COMMAND, command: 'commit-msg', args: 'full closes #690' })
  await clock.settle()

  expect(systems[0]).toContain('footer of git trailers')

  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /Refs #690/ })).toBeDefined()
  await ui.press({ key: 'copy' })

  expect(copied[0]).toBe(
    'fix: return the quote total\n\nTotals were computed but never returned, so\nproposals showed zero.\n\nRefs #690',
  )
})

test('edits the subject in place before copying', async ($, on) => {
  const { copied, clock } = gitHost(on)

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...COMMAND, command: 'commit-msg', args: '' })
  await clock.settle()

  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'edit' })
  await ui.input({ key: 'subject', text: 'fix: return quote totals #690', kind: 'change' })
  await ui.press({ key: 'edit' })
  await ui.press({ key: 'copy' })

  expect(copied).toEqual(['fix: return quote totals #690'])
})

test('regenerates from guidance and keeps earlier drafts', async ($, on) => {
  const { prompts, copied, clock } = gitHost(on, { replies: ['fix: return the quote total', 'fix: return totals'] })

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...COMMAND, command: 'commit-msg', args: '' })
  await clock.settle()

  const ui = await mountPane($, 'terminal')
  await ui.input({ key: 'note', text: 'shorter' })
  await clock.settle()

  expect(prompts[1]).toContain('Note from the author: shorter')
  expect(prompts[1]).toContain("The author's current draft")
  expect(await ui.find({ type: 'Text', text: /draft 2\/2/ })).toBeDefined()

  await ui.press({ key: 'prev' })
  await ui.press({ key: 'copy' })

  expect(copied).toEqual(['fix: return the quote total'])
})

test('answers in the transcript when the pane cannot be placed', async ($, on) => {
  const { copied } = gitHost(on, { isPlaced: false })

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  const answer = await $.command.run({ ...COMMAND, command: 'commit-msg', args: '' })

  expect(answer.text).toContain('fix: return the quote total')
  expect(answer.text).toContain('For staged changes, from the diff alone. Copied to your clipboard.')
  expect(copied).toEqual(['fix: return the quote total'])
})

test('says so when there is nothing to commit', async ($, on) => {
  const { prompts, clock } = gitHost(on, { staged: '' })

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...COMMAND, command: 'commit-msg', args: '' })
  await clock.settle()

  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /Nothing to commit/ })).toBeDefined()
  expect(prompts).toEqual([])
})

test('sends new files and leaves lockfile diffs out', async ($, on) => {
  const { prompts, commands, clock } = gitHost(on, {
    staged: '',
    unstaged: 'diff --git a/app/Old.php b/app/Old.php\n+ old change\n',
    unstagedStat: ' app/Old.php | 1 +\n composer.lock | 2 +-\n',
    untracked: { 'app/Invoice.php': '+class Invoice {}', 'package-lock.json': '+{"lockfileVersion": 3}' },
  })

  await startSession($)
  await clock.settle()

  expect(prompts[0]).toContain('+class Invoice {}')
  expect(prompts[0]).not.toContain('lockfileVersion')
  expect(prompts[0]).toContain('composer.lock | 2 +-')
  expect(commands.find(args => args.startsWith('diff HEAD --no-color'))).toContain(':(exclude,glob)**/composer.lock')
  expect(commands.filter(args => args.startsWith('diff --no-index'))).toHaveLength(1)
})

test('writes a message when only a lockfile changed', async ($, on) => {
  const { prompts, clock } = gitHost(on, { staged: '', unstagedStat: ' composer.lock | 2 +-\n' })

  await startSession($)
  await clock.settle()

  expect(prompts).toHaveLength(1)
  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /Nothing to commit/ })).toBeUndefined()
})

test('colours the conventional subject and flags breaking changes', async ($, on) => {
  const { systems, clock } = gitHost(on, {
    replies: [
      JSON.stringify({
        subject: 'feat(api)!: drop the v1 totals endpoint',
        body: ['Clients must call v2.'],
        footer: ['BREAKING CHANGE: v1 totals are gone', 'Refs #690'],
      }),
    ],
  })

  await startSession($, 'full')
  await clock.settle()

  expect(systems[0]).toContain('imperative mood')
  expect(systems[0]).toContain('Put "!" after the type or scope')

  const ui = await mountPane($, 'terminal')
  expect((await ui.find({ type: 'Text', text: /^feat$/ }))?.props.color).toBe('claude')
  expect((await ui.find({ type: 'Text', text: /^\(api\)$/ }))?.props.color).toBe('suggestion')
  expect((await ui.find({ type: 'Text', text: /^!$/ }))?.props.color).toBe('error')
  expect((await ui.find({ type: 'Text', text: /^drop the v1 totals endpoint$/ }))?.props.bold).toBe(true)

  const breaking = await ui.find({ type: 'Text', text: /^BREAKING CHANGE/ })
  expect(breaking?.props.color).toBe('error')
  expect(breaking?.props.bold).toBe(true)
  expect((await ui.find({ type: 'Text', text: /^Refs #690$/ }))?.props.color).toBe('suggestion')
})

test('keeps the draft and the note on screen when a regenerate fails', async ($, on) => {
  const { clock } = gitHost(on, { replies: ['fix: return the quote total', null] })

  await startSession($)
  await clock.settle()

  const ui = await mountPane($, 'terminal')
  await ui.input({ key: 'note', text: 'shorter' })
  await clock.settle()

  expect(await ui.find({ type: 'Text', text: /Could not write a message \(api-error\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^return the quote total$/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'copy' })).toBeDefined()
  expect((await ui.find({ type: 'Input', key: 'note' }))?.props.value).toBe('shorter')

  await ui.press({ key: 'style:simple' })

  expect(await ui.find({ type: 'Text', text: /Could not write/ })).toBeUndefined()
})

test('clears the guidance note after a regenerate', async ($, on) => {
  const { prompts, clock } = gitHost(on, { replies: ['fix: return the quote total', 'fix: return totals', 'fix: totals'] })

  await startSession($)
  await clock.settle()

  const ui = await mountPane($, 'terminal')
  await ui.input({ key: 'note', text: 'shorter' })
  await clock.settle()

  expect((await ui.find({ type: 'Input', key: 'note' }))?.props.value).toBe('')

  await ui.press({ key: 'regenerate' })
  await clock.settle()

  expect(prompts[2]).not.toContain('Note from the author')
})

test('shows the subject counter while editing', async ($, on) => {
  const { clock } = gitHost(on)

  await startSession($)
  await clock.settle()

  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'edit' })

  expect(await ui.find({ type: 'Input', key: 'subject' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^27\/72$/ })).toBeDefined()
})

test('draws rules only when docked', async ($, on) => {
  const { clock } = gitHost(on)

  await startSession($)
  await clock.settle()

  const inline = await mountPane($, 'terminal', 'inline')
  expect(await inline.find({ type: 'Text', text: /^─+$/ })).toBeUndefined()
  await inline.unmount()

  const docked = await mountPane($, 'terminal', 'dock')
  expect(await docked.findAll({ type: 'Text', text: /^─+$/ })).toHaveLength(2)
})

test('hides Copy until there is a draft and draws no Close button', async ($, on) => {
  const { clock } = gitHost(on, { staged: '' })

  await startSession($)
  await clock.settle()

  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ type: 'Button', key: 'copy' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'close' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'regenerate' })).toBeDefined()
})

test('writes from the session when the fork answers', async ($, on) => {
  const { prompts, forks, copied } = gitHost(on, { isPlaced: false, fork: 'fix: return the quote total so proposals show it' })

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  const answer = await $.command.run({ ...COMMAND, command: 'commit-msg', args: '' })

  expect(forks).toHaveLength(1)
  expect(forks[0]).toContain('Pause the work and write a git commit message instead')
  expect(forks[0]).toContain('subject line only')
  expect(forks[0]).toContain(STAGED)
  expect(prompts).toEqual([])
  expect(answer.text).toContain('For staged changes, with session context. Copied to your clipboard.')
  expect(copied).toEqual(['fix: return the quote total so proposals show it'])
})

test('reports an aborted fork without falling back to the diff', async ($, on) => {
  const { prompts, forks, clock } = gitHost(on, { fork: 'aborted' })

  await startSession($)
  await clock.settle()

  expect(forks).toHaveLength(1)
  expect(prompts).toEqual([])

  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /Could not write a message \(aborted\)/ })).toBeDefined()
})

test('writes from the diff alone when session context is off', { options: { useSession: false } }, async ($, on) => {
  const { prompts, forks, copied } = gitHost(on, { isPlaced: false, fork: 'fix: from the session' })

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  const answer = await $.command.run({ ...COMMAND, command: 'commit-msg', args: '' })

  expect(forks).toEqual([])
  expect(prompts).toHaveLength(1)
  expect(answer.text).toContain('For staged changes, from the diff alone. Copied to your clipboard.')
  expect(copied).toEqual(['fix: return the quote total'])
})
