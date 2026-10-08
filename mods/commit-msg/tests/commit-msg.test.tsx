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

const gitHost = (on: On, options: { staged?: string; isPlaced?: boolean; replies?: string[] } = {}) => {
  const prompts: string[] = []
  const systems: string[] = []
  const copied: string[] = []
  const replies = [...(options.replies ?? ['fix: return the quote total'])]
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

    return { value: { isAnswered: true as const, text: replies.shift() ?? 'fix: again', usage } }
  })
  on('ui.copy', (_, e) => {
    copied.push(e.text)

    return { value: { isCopied: true as const } }
  })

  return { prompts, systems, copied, clock }
}

const mountPane = ($: Parameters<TestBody>[0], surface: 'terminal' | 'desktop') =>
  $.ui.mount({
    plugin: 'commit-msg',
    surface,
    component: 'Pane',
    requestId: 'commit-msg',
    props: { title: 'Commit message', bodyColumns: 100 } as never,
  })

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
  expect(answer.text).toContain('For staged changes. Copied to your clipboard.')
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
