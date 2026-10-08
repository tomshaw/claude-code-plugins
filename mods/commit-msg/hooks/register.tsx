import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Composer, Draft, Style } from '../types'

const COMMAND = 'commit-msg'
const PANE = 'commit-msg'
const MAX_DIFF = 60_000
const RECENT_COMMITS = 20
const MAX_DRAFTS = 10
const SUBJECT_LIMIT = 72

const STYLES: Style[] = ['simple', 'body', 'full']
const STYLE_LABELS: Record<Style, string> = { simple: 'Simple', body: 'With body', full: 'With footer' }
const STYLE_ALIASES: Record<string, Style> = { simple: 'simple', body: 'body', full: 'full', footer: 'full' }

const settings = { model: 'sonnet', style: 'simple' as Style }
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
Describe what changed and why it matters, not file names. Never invent work the diff does not show.
Reply with JSON only, no code fences: {"subject": "...", "body": ["..."], "footer": ["..."]}`

type Changes = { diff: string; stat: string; isStaged: boolean; untracked: string[] }

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
    return { diff: staged, stat: await git($, ['diff', '--cached', '--stat']), isStaged: true, untracked: [] }
  }

  const hasHead = (await $.process.run(['git', 'rev-parse', '--verify', '--quiet', 'HEAD'])).exitCode === 0
  const base = hasHead ? ['HEAD'] : []

  return {
    diff: await git($, ['diff', ...base, '--no-color', '--no-ext-diff']),
    stat: await git($, ['diff', ...base, '--stat']),
    isStaged: false,
    untracked: (await git($, ['ls-files', '--others', '--exclude-standard'])).split('\n').filter(line => line !== ''),
  }
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
  const diff =
    changes.diff.length > MAX_DIFF
      ? `${changes.diff.slice(0, MAX_DIFF)}\n[diff cut at ${MAX_DIFF} characters; the stat above lists every file]`
      : changes.diff

  return [
    `Recent commit subjects, newest first:\n${subjects.trim() || '(none yet)'}`,
    `Branch: ${branch.trim()}`,
    note === '' ? '' : `Note from the author: ${note}`,
    previous === undefined ? '' : `The author's current draft, to rewrite following the note:\n${format(previous)}`,
    changes.untracked.length > 0 ? `New untracked files (contents not shown):\n${changes.untracked.join('\n')}` : '',
    `Diff stat:\n${changes.stat.trim()}`,
    `Diff:\n${diff}`,
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
    if (changes.diff.trim() === '' && changes.untracked.length === 0) {
      return await fail('Nothing to commit: no staged or uncommitted changes.')
    }

    const subjects = await git($, ['log', '-n', String(RECENT_COMMITS), '--no-merges', '--format=%s']).catch(() => '')
    const branch = await git($, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '(none)')
    const reply = await $.model.complete({
      model: settings.model,
      system: systemFor(style),
      prompt: buildPrompt(changes, subjects, branch, note, previous),
      maxTokens: 1200,
      timeoutMs: 90_000,
    })

    if (!reply.isAnswered) {
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
        scope: changes.isStaged ? 'staged changes' : 'all uncommitted changes',
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
    await update($, composer, one => ({ ...one, style, index: latest, isEditing: false }))

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

    return draft === undefined ? state : { ...state, index, style: draft.style, isEditing: false, copiedAt: 0 }
  })

const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Commit message', focus: true })

const parseArgs = (args: string): { style: Style | undefined; note: string } => {
  const [first = '', ...rest] = args.trim().split(/\s+/)
  const style = STYLE_ALIASES[first.toLowerCase()]

  return style === undefined ? { style: undefined, note: args.trim() } : { style, note: rest.join(' ') }
}

export const register: Register = (on, options) => {
  settings.model = String(options.model ?? 'sonnet') || 'sonnet'
  settings.style = STYLE_ALIASES[String(options.style ?? '')] ?? 'simple'

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
    const rule = <Text dimColor>{'─'.repeat(Math.max(10, width - 2))}</Text>

    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="claude">
          📝 Commit message
        </Text>
        <Text dimColor>
          {[
            state.scope,
            state.drafts.length > 1 ? `draft ${state.index + 1}/${state.drafts.length}` : '',
            state.copiedAt > 0 ? '✓ copied' : '',
          ]
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
            dimColor={style !== state.style}
            onPress={() => pickStyle($, style)}
          />
        ))}
      </Box>
    )

    const subjectLength = draft?.subject.trim().length ?? 0
    const shown = draft === undefined ? undefined : { ...draft, body: tidyLines(draft.body), footer: tidyLines(draft.footer) }

    const message =
      state.phase === 'error' ? (
        <Text color="error" wrap="wrap">
          {state.error}
        </Text>
      ) : shown === undefined ? (
        <Text dimColor>{isWriting ? 'Reading your changes and writing…' : 'Run /commit-msg to write a message.'}</Text>
      ) : (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between" gap={1}>
            <Text bold wrap="wrap">
              {shown.subject}
            </Text>
            <Text color={subjectLength > SUBJECT_LIMIT ? 'warning' : 'inactive'}>
              {subjectLength}/{SUBJECT_LIMIT}
            </Text>
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
                    <Text key={`footer:${index}`} color="suggestion" wrap="wrap">
                      {line}
                    </Text>
                  ))
              )}
            </Box>
          )}
          {isWriting && <Text dimColor>Rewriting…</Text>}
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
          {draft.style !== 'simple' && (
            <Box flexDirection="column" marginTop={1}>
              {draft.body.map((line, index) => (
                <Input
                  key={`body:${index}`}
                  label={index === 0 ? 'Body    ' : '        '}
                  placeholder="(blank line)"
                  value={line}
                  onInput={value =>
                    void setDraft($, one => ({ ...one, body: one.body.map((old, at) => (at === index ? value : old)) }))
                  }
                  onSubmit={value =>
                    void setDraft($, one => ({ ...one, body: one.body.map((old, at) => (at === index ? value : old)) }))
                  }
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
                  onInput={value =>
                    void setDraft($, one => ({ ...one, footer: one.footer.map((old, at) => (at === index ? value : old)) }))
                  }
                  onSubmit={value =>
                    void setDraft($, one => ({ ...one, footer: one.footer.map((old, at) => (at === index ? value : old)) }))
                  }
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
      <Box flexDirection="column" width={width} gap={1}>
        {header}
        {styles}
        {rule}
        {isEditing ? editor : message}
        {rule}
        {guidance}
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          <Button
            key="copy"
            label={state.copiedAt > 0 ? 'Copied ✓' : 'Copy'}
            hotkey="c"
            variant="primary"
            onPress={press => copy($, press.surface)}
          />
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
          <Button key="close" label="Close" hotkey="x" dimColor onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
