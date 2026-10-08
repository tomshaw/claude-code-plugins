import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Composer, Draft, Style } from '../types'

const COMMAND = 'commit-msg'
const PANE = 'commit-msg'
const MAX_DIFF = 60_000
const RECENT_COMMITS = 20
const MAX_DRAFTS = 10
const SUBJECT_LIMIT = 72
const MAX_UNTRACKED = 25
const LOCKFILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'composer.lock', 'Cargo.lock', 'Gemfile.lock', 'poetry.lock', 'uv.lock']
const QUIET_PATHS = ['--', '.', ...LOCKFILES.map(name => `:(exclude,glob)**/${name}`)]
const CONVENTIONAL = /^([A-Za-z]+)(\([^)]*\))?(!)?(:\s*)(.*)$/s

const STYLES: Style[] = ['simple', 'body', 'full']
const STYLE_LABELS: Record<Style, string> = { simple: 'Simple', body: 'With body', full: 'With footer' }
const STYLE_ALIASES: Record<string, Style> = { simple: 'simple', body: 'body', full: 'full', footer: 'full' }

const settings = { model: 'sonnet', style: 'simple' as Style, useSession: true }
const runs = { latest: 0 }

const composer = atom({ plugin: 'commit-msg', key: 'composer' } as const, {
  phase: 'idle',
  style: 'simple',
  note: '',
  scope: '',
  error: '',
  drafts: [],
  index: -1,
  isEditing: false,
  copiedAt: 0,
} satisfies Composer)

const STYLE_RULES: Record<Style, string> = {
  simple: 'Write the subject line only: "body" and "footer" are empty arrays.',
  body: `Write the subject line and a body explaining what changed and why, as short paragraphs or "- " bullets.
Each "body" entry is one line of at most ${SUBJECT_LIMIT} characters; an empty string separates paragraphs. "footer" is an empty array.`,
  full: `Write the subject line, a body explaining what changed and why, as short paragraphs or "- " bullets, and a footer of git trailers.
Each "body" entry is one line of at most ${SUBJECT_LIMIT} characters; an empty string separates paragraphs.
Each "footer" entry is one trailer: "Refs #123" or "Closes #123" when the branch, a note or the recent commits give an issue number, "BREAKING CHANGE: ..." when the diff changes behaviour callers rely on. Use only trailers the evidence supports.`,
}

const systemFor = (style: Style): string => `You write git commit messages. The user message holds a repository's recent commit subjects, its branch, and a diff.
Write one commit message for the diff. The subject line matches the recent commits' style exactly: their prefixes (feat:, fix:, chore: and so on), tense, casing, length, and how they reference issue numbers. Add an issue number only when the branch name or a note gives one.
${STYLE_RULES[style]}
When choosing the type: feat adds a capability, fix corrects a bug, refactor restructures without changing behaviour, perf speeds something up, docs, test, build, ci, style and chore cover the rest. Put "!" after the type or scope when the change breaks behaviour callers rely on.
Write the description in the imperative mood, with no trailing period.
Describe what changed and why it matters, not file names. Never invent work the diff does not show.
Reply with JSON only, no code fences: {"subject": "...", "body": ["..."], "footer": ["..."]}`

const forkFor = (style: Style, prompt: string): string => `Pause the work and write a git commit message instead. Take no actions; reply only as these rules say.

${systemFor(style)}

This conversation is where the changes below were made. Use it to explain why: the problem being solved, what was asked for, the decisions taken and what was ruled out.
The diff is the only record of what this commit contains. Describe only work the diff shows: leave out anything this conversation did that the diff does not hold, such as unstaged edits, reverted attempts or other commits, and describe changes the conversation never discussed from the diff alone.

${prompt}`

type Written = { text: string; isFromSession: boolean } | { reason: string }

const write = async ($: EngineInterface, style: Style, prompt: string): Promise<Written> => {
  if (settings.useSession) {
    const forked = await $.model.fork({ prompt: forkFor(style, prompt) })
    if (forked.isAnswered) {
      return { text: forked.text, isFromSession: true }
    }
    if (forked.reason === 'aborted') {
      return { reason: forked.reason }
    }
  }

  const reply = await $.model.complete({
    model: settings.model,
    system: systemFor(style),
    prompt,
    maxTokens: 1200,
    timeoutMs: 90_000,
  })

  return reply.isAnswered ? { text: reply.text, isFromSession: false } : { reason: reply.reason }
}

type Changes = { diff: string; stat: string; isStaged: boolean; untracked: string[]; added: string }

const git = async ($: EngineInterface, args: string[]): Promise<string> => {
  const ran = await $.process.run(['git', ...args], { timeoutMs: 20_000 })
  if (ran.exitCode !== 0) {
    throw new Error(ran.stderr.trim() || `git ${args[0]} failed`)
  }

  return ran.stdout
}

const readChanges = async ($: EngineInterface): Promise<Changes> => {
  const staged = await git($, ['diff', '--cached', '--no-color', '--no-ext-diff'])
  if (staged.trim() !== '') {
    return {
      diff: await git($, ['diff', '--cached', '--no-color', '--no-ext-diff', ...QUIET_PATHS]),
      stat: await git($, ['diff', '--cached', '--stat']),
      isStaged: true,
      untracked: [],
      added: '',
    }
  }

  const hasHead = (await $.process.run(['git', 'rev-parse', '--verify', '--quiet', 'HEAD'])).exitCode === 0
  const base = hasHead ? ['HEAD'] : []

  const untracked = (await git($, ['ls-files', '--others', '--exclude-standard'])).split('\n').filter(line => line !== '')

  return {
    diff: await git($, ['diff', ...base, '--no-color', '--no-ext-diff', ...QUIET_PATHS]),
    stat: await git($, ['diff', ...base, '--stat']),
    isStaged: false,
    untracked,
    added: await readUntracked($, untracked),
  }
}

const readUntracked = async ($: EngineInterface, files: string[]): Promise<string> => {
  const parts: string[] = []
  let size = 0
  for (const file of files.filter(one => !LOCKFILES.some(name => one.endsWith(name))).slice(0, MAX_UNTRACKED)) {
    const ran = await $.process.run(['git', 'diff', '--no-index', '--no-color', '--', '/dev/null', file], { timeoutMs: 10_000 })
    if (ran.exitCode > 1 || size + ran.stdout.length > MAX_DIFF / 2) {
      continue
    }
    parts.push(ran.stdout)
    size += ran.stdout.length
  }

  return parts.join('')
}

const tidyLines = (lines: string[]): string[] => {
  const tidy: string[] = []
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line !== '' || (tidy.length > 0 && tidy[tidy.length - 1] !== '')) {
      tidy.push(line)
    }
  }
  while (tidy[tidy.length - 1] === '') {
    tidy.pop()
  }

  return tidy
}

const format = (draft: Draft): string => {
  const body = draft.style === 'simple' ? [] : tidyLines(draft.body)
  const footer = draft.style === 'full' ? draft.footer.map(line => line.trim()).filter(line => line !== '') : []

  return [draft.subject.trim(), body.join('\n'), footer.join('\n')].filter(part => part !== '').join('\n\n')
}

const buildPrompt = (changes: Changes, subjects: string, branch: string, note: string, previous: Draft | undefined): string => {
  const combined = changes.diff + changes.added
  const diff =
    combined.length > MAX_DIFF
      ? `${combined.slice(0, MAX_DIFF)}\n[diff cut at ${MAX_DIFF} characters; the stat above lists every file]`
      : combined

  return [
    `Recent commit subjects, newest first:\n${subjects.trim() || '(none yet)'}`,
    `Branch: ${branch.trim()}`,
    note === '' ? '' : `Note from the author: ${note}`,
    previous === undefined ? '' : `The author's current draft, to rewrite following the note:\n${format(previous)}`,
    changes.untracked.length > 0 ? `New untracked files (their contents, where small enough, are in the diff):\n${changes.untracked.join('\n')}` : '',
    `Diff stat:\n${changes.stat.trim()}`,
    `Diff (lockfile changes omitted; the stat lists them):\n${diff}`,
  ]
    .filter(part => part !== '')
    .join('\n\n')
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : []

const isTrailer = (line: string): boolean => /^(BREAKING CHANGE|[A-Z][A-Za-z-]+):\s|^(Refs|Closes|Fixes)\s+#\d+/.test(line)

const parseReply = (text: string, style: Style): Draft => {
  const cleaned = text
    .trim()
    .replace(/^```[a-z]*\n?|\n?```$/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)) as Record<string, unknown>
    if (typeof parsed.subject === 'string' && parsed.subject.trim() !== '') {
      return { style, subject: parsed.subject.trim(), body: strings(parsed.body), footer: strings(parsed.footer) }
    }
  } catch {}

  const [subject = '', ...rest] = cleaned.replace(/^["'`]|["'`]$/g, '').split('\n')
  const lines = rest.join('\n').trim().split('\n')
  const footerStart = lines.findIndex((_, index) => lines.slice(index).every(line => line === '' || isTrailer(line)))
  const hasFooter = footerStart >= 0 && lines.slice(footerStart).some(isTrailer)

  return {
    style,
    subject: subject.trim(),
    body: hasFooter ? lines.slice(0, footerStart) : lines,
    footer: hasFooter ? lines.slice(footerStart).filter(line => line !== '') : [],
  }
}

const current = (state: Composer): Draft | undefined => state.drafts[state.index]

const setDraft = ($: EngineInterface, change: (draft: Draft) => Draft) =>
  update($, composer, state => {
    const draft = current(state)
    if (draft === undefined) {
      return state
    }

    return { ...state, drafts: state.drafts.map((one, index) => (index === state.index ? change(one) : one)) }
  })

const generate = async ($: EngineInterface, style: Style, revise: boolean): Promise<string | undefined> => {
  const run = ++runs.latest
  const before = await read($, composer)
  const previous = revise ? current(before) : undefined
  const note = before.note.trim()
  await update($, composer, state => ({ ...state, style, phase: 'writing' as const, error: '', isEditing: false }))
  $.ui.status('commit-msg: writing…')

  const fail = async (error: string): Promise<undefined> => {
    if (run === runs.latest) {
      await update($, composer, state => ({ ...state, phase: 'error' as const, error }))
    }

    return undefined
  }

  try {
    if ((await $.process.run(['git', 'rev-parse', '--is-inside-work-tree'])).exitCode !== 0) {
      return await fail('Not a git repository.')
    }

    const changes = await readChanges($)
    if (changes.diff.trim() === '' && changes.stat.trim() === '' && changes.untracked.length === 0) {
      return await fail('Nothing to commit: no staged or uncommitted changes.')
    }

    const subjects = await git($, ['log', '-n', String(RECENT_COMMITS), '--no-merges', '--format=%s']).catch(() => '')
    const branch = await git($, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '(none)')
    const reply = await write($, style, buildPrompt(changes, subjects, branch, note, previous))

    if ('reason' in reply) {
      return await fail(`Could not write a message (${reply.reason}).`)
    }
    if (run !== runs.latest) {
      return undefined
    }

    const draft = parseReply(reply.text, style)
    await update($, composer, state => {
      const drafts = [...state.drafts, draft].slice(-MAX_DRAFTS)

      return {
        ...state,
        phase: 'ready' as const,
        note: state.note.trim() === note ? '' : state.note,
        scope: [changes.isStaged ? 'staged changes' : 'all uncommitted changes', reply.isFromSession ? 'with session context' : 'from the diff alone'].join(', '),
        drafts,
        index: drafts.length - 1,
        copiedAt: 0,
      }
    })

    return format(draft)
  } catch (error) {
    return await fail(error instanceof Error ? error.message : String(error))
  } finally {
    if (run === runs.latest) {
      $.ui.status(undefined)
    }
  }
}

const start = ($: EngineInterface, style: Style, revise = false): void => {
  $.clock.after(0, () => {
    void generate($, style, revise)
  })
}

const pickStyle = async ($: EngineInterface, style: Style): Promise<void> => {
  const state = await read($, composer)
  if (state.phase === 'writing') {
    return
  }

  const latest = state.drafts.findLastIndex(draft => draft.style === style)
  if (latest >= 0) {
    await update($, composer, one => ({ ...one, style, index: latest, phase: 'ready' as const, error: '', isEditing: false }))

    return
  }

  start($, style)
}

const copy = async ($: EngineInterface, surface?: RenderSurface): Promise<void> => {
  const draft = current(await read($, composer))
  if (draft === undefined) {
    return
  }

  const copied = await $.ui.copy({ text: format(draft), surface })
  if (copied.isCopied) {
    const now = await $.clock.now()
    await update($, composer, state => ({ ...state, copiedAt: now }))
    $.ui.toast('commit-msg: copied to your clipboard')
  } else {
    $.ui.toast(`commit-msg: not copied (${copied.reason})`)
  }
}

const step = ($: EngineInterface, by: number) =>
  update($, composer, state => {
    const index = Math.min(state.drafts.length - 1, Math.max(0, state.index + by))
    const draft = state.drafts[index]

    return draft === undefined
      ? state
      : { ...state, index, style: draft.style, phase: 'ready' as const, error: '', isEditing: false, copiedAt: 0 }
  })

const setLine = ($: EngineInterface, field: 'body' | 'footer', index: number) => (value: string) =>
  void setDraft($, one => ({ ...one, [field]: one[field].map((old, at) => (at === index ? value : old)) }))

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Commit message', focus: true })

const parseArgs = (args: string): { style: Style | undefined; note: string } => {
  const [first = '', ...rest] = args.trim().split(/\s+/)
  const style = STYLE_ALIASES[first.toLowerCase()]

  return style === undefined ? { style: undefined, note: args.trim() } : { style, note: rest.join(' ') }
}

export const register: Register = (on, options) => {
  settings.model = String(options.model ?? 'sonnet') || 'sonnet'
  settings.style = STYLE_ALIASES[String(options.style ?? '')] ?? 'simple'
  settings.useSession = options.useSession !== false

  on('session.start', async ($, e, next) => {
    await $.command
      .register({
        name: COMMAND,
        description: 'Write a commit message in a pane: pick a style, edit, regenerate, copy',
        argumentHint: '[simple|body|full] [note]',
      })
      .catch(() => $.ui.toast('commit-msg: could not register /commit-msg'))

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const asked = parseArgs(e.args)
    const before = await read($, composer)
    const style = asked.style ?? (before.drafts.length > 0 ? before.style : settings.style)
    await update($, composer, state => ({ ...state, style, note: asked.note, drafts: [], index: -1, copiedAt: 0 }))

    const opened = await openPane($)
    if (opened.isPlaced) {
      start($, style)

      return { text: `Writing a ${STYLE_LABELS[style].toLowerCase()} commit message in the pane.` }
    }

    const message = await generate($, style, false)
    const after = await read($, composer)
    if (message === undefined) {
      return { text: after.error }
    }

    const copied = await $.ui.copy({ text: message })

    return {
      text: [
        message,
        '',
        `For ${after.scope}. ${copied.isCopied ? 'Copied to your clipboard.' : `Not copied (${copied.reason}).`}`,
      ].join('\n'),
    }
  }).catch(() => ({ text: 'commit-msg: something went wrong writing the message.' }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Text, Button } = table
    const Input = 'Input' in table ? table.Input : undefined
    const state = await read($, composer)
    const draft = current(state)
    const width = e.props.bodyColumns ?? e.viewport?.columns ?? 80
    const isWriting = state.phase === 'writing'
    const canEdit = Input !== undefined && draft !== undefined && !isWriting
    const isEditing = canEdit && state.isEditing
    const isDocked = e.props.placement === 'dock'
    const rule = isDocked ? <Text dimColor>{'─'.repeat(Math.max(10, width))}</Text> : null
    const subjectLength = draft?.subject.trim().length ?? 0
    const counter = (
      <Text color={subjectLength > SUBJECT_LIMIT ? 'warning' : 'inactive'}>
        {subjectLength}/{SUBJECT_LIMIT}
      </Text>
    )

    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="claude">
          📝 Commit message
        </Text>
        <Text dimColor>
          {[state.scope, state.drafts.length > 1 ? `draft ${state.index + 1}/${state.drafts.length}` : '']
            .filter(part => part !== '')
            .join(' · ')}
        </Text>
      </Box>
    )

    const styles = (
      <Box flexDirection="row" gap={1}>
        <Text dimColor>Style</Text>
        {STYLES.map((style, index) => (
          <Button
            key={`style:${style}`}
            label={STYLE_LABELS[style]}
            hotkey={String(index + 1)}
            variant={style === state.style ? 'primary' : undefined}
            dimColor={isWriting || style !== state.style}
            onPress={() => pickStyle($, style)}
          />
        ))}
      </Box>
    )

    const shown = draft === undefined ? undefined : { ...draft, body: tidyLines(draft.body), footer: tidyLines(draft.footer) }
    const parts = shown === undefined ? null : CONVENTIONAL.exec(shown.subject.trim())
    const error =
      state.phase === 'error' ? (
        <Text color="error" wrap="wrap">
          ✗ {state.error}
        </Text>
      ) : null

    const message =
      shown === undefined ? (
        (error ?? (
          <Text dimColor>{isWriting ? '◌ Reading your changes and writing…' : 'Run /commit-msg to write a message.'}</Text>
        ))
      ) : (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between" gap={1}>
            {parts === null ? (
              <Text bold wrap="wrap">
                {shown.subject}
              </Text>
            ) : (
              <Text wrap="wrap">
                <Text bold color="claude">
                  {parts[1]}
                </Text>
                {parts[2] !== undefined && <Text color="suggestion">{parts[2]}</Text>}
                {parts[3] !== undefined && (
                  <Text bold color="error">
                    !
                  </Text>
                )}
                <Text dimColor>{parts[4]}</Text>
                <Text bold>{parts[5]}</Text>
              </Text>
            )}
            {counter}
          </Box>
          {shown.style !== 'simple' && shown.body.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              {shown.body.map((line, index) => (
                <Text key={`body:${index}`} wrap="wrap">
                  {line === '' ? ' ' : line}
                </Text>
              ))}
            </Box>
          )}
          {shown.style === 'full' && (
            <Box flexDirection="column" marginTop={1}>
              {shown.footer.filter(line => line !== '').length === 0 ? (
                <Text dimColor>No footer: edit to add a trailer such as Refs #123.</Text>
              ) : (
                shown.footer
                  .filter(line => line !== '')
                  .map((line, index) => (
                    <Text
                      key={`footer:${index}`}
                      color={/^BREAKING[ -]CHANGE:/.test(line) ? 'error' : 'suggestion'}
                      bold={/^BREAKING[ -]CHANGE:/.test(line)}
                      wrap="wrap"
                    >
                      {line}
                    </Text>
                  ))
              )}
            </Box>
          )}
          {isWriting && <Text dimColor>◌ Rewriting…</Text>}
          {error}
        </Box>
      )

    const editor =
      !isEditing || Input === undefined || draft === undefined ? null : (
        <Box flexDirection="column">
          <Input
            key="subject"
            label="Subject "
            value={draft.subject}
            submitLabel="done"
            autoFocus
            onInput={value => void setDraft($, one => ({ ...one, subject: value }))}
            onSubmit={value => void setDraft($, one => ({ ...one, subject: value }))}
          />
          <Box flexDirection="row" justifyContent="flex-end">
            {counter}
          </Box>
          {draft.style !== 'simple' && (
            <Box flexDirection="column" marginTop={1}>
              {draft.body.map((line, index) => (
                <Input
                  key={`body:${index}`}
                  label={index === 0 ? 'Body    ' : '        '}
                  placeholder="(blank line)"
                  value={line}
                  onInput={setLine($, 'body', index)}
                  onSubmit={setLine($, 'body', index)}
                />
              ))}
              <Button
                key="add:body"
                label="+ body line"
                hotkey="a"
                dimColor
                onPress={() => setDraft($, one => ({ ...one, body: [...one.body, ''] }))}
              />
            </Box>
          )}
          {draft.style === 'full' && (
            <Box flexDirection="column" marginTop={1}>
              {draft.footer.map((line, index) => (
                <Input
                  key={`footer:${index}`}
                  label={index === 0 ? 'Footer  ' : '        '}
                  placeholder="Refs #123"
                  value={line}
                  onInput={setLine($, 'footer', index)}
                  onSubmit={setLine($, 'footer', index)}
                />
              ))}
              <Button
                key="add:footer"
                label="+ footer line"
                hotkey="f"
                dimColor
                onPress={() => setDraft($, one => ({ ...one, footer: [...one.footer, ''] }))}
              />
            </Box>
          )}
        </Box>
      )

    const guidance =
      Input === undefined ? null : (
        <Input
          key="note"
          label="Guidance "
          placeholder="e.g. shorter, mention #690, focus on the API change"
          value={state.note}
          submitLabel="regenerate"
          onInput={value => void update($, composer, one => ({ ...one, note: value }))}
          onSubmit={value => {
            void update($, composer, one => ({ ...one, note: value })).then(() => start($, state.style, true))
          }}
        />
      )

    return (
      <Box flexDirection="column" width={width} gap={isDocked ? 1 : 0}>
        {header}
        {styles}
        {rule}
        {isEditing ? editor : message}
        {rule}
        {guidance}
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          {draft !== undefined && (
            <Button
              key="copy"
              label={state.copiedAt > 0 ? 'Copied ✓' : 'Copy'}
              hotkey="c"
              variant="primary"
              onPress={press => copy($, press.surface)}
            />
          )}
          <Button
            key="regenerate"
            label={isWriting ? 'Writing…' : 'Regenerate'}
            hotkey="r"
            onPress={() => {
              if (!isWriting) {
                start($, state.style, draft !== undefined)
              }
            }}
          />
          {canEdit && (
            <Button
              key="edit"
              label={isEditing ? 'Done' : 'Edit'}
              hotkey="e"
              onPress={() => update($, composer, one => ({ ...one, isEditing: !one.isEditing, copiedAt: 0 }))}
            />
          )}
          {state.drafts.length > 1 && (
            <Button key="prev" label="‹ Prev" hotkey="p" dimColor={state.index === 0} onPress={() => step($, -1)} />
          )}
          {state.drafts.length > 1 && (
            <Button
              key="next"
              label="Next ›"
              hotkey="n"
              dimColor={state.index === state.drafts.length - 1}
              onPress={() => step($, 1)}
            />
          )}
        </Box>
      </Box>
    )
  })
}
