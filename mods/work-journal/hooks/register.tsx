import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Bucket, JournalWindow, ProjectReview, Review, Status } from '../types'
import type { ProjectEntries } from './history'
import { activeMinutes, activity, filterScript, formatMinutes, groupByProject, parseHistory } from './history'
import { PROJECT_COLORS, renderHtml } from './html'
import { emptyProject, parseReply, summaryRequest, threadLimit } from './summarize'
import { bounds, fileStem, isComplete, localDate, parseArgs, shiftWindow, windowFor } from './window'

const PANE = 'work-journal'
const MAX_PROJECTS = 6
const FRESH_MS = 15 * 60_000
const CACHE_LIMIT = 60
const SPARKS = ' ▁▂▃▄▅▆▇█'
const KIND_TITLE = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const

const view = atom({ plugin: 'work-journal', key: 'view' } as const, null)
const current = atom({ plugin: 'work-journal', key: 'review' } as const, null)
const status = atom({ plugin: 'work-journal', key: 'status' } as const, { phase: 'idle' })

const plural = (count: number, word: string): string => `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`

export const sparkline = (buckets: readonly Bucket[]): string => {
  const peak = Math.max(1, ...buckets.map(bucket => bucket.count))

  return buckets.map(bucket => (bucket.count === 0 ? '·' : (SPARKS[Math.max(1, Math.round((bucket.count / peak) * 8))] ?? '█'))).join('')
}

const settings = { excluded: [] as string[], model: 'opus' }
let offsetMinutes: number | undefined
let loadToken = 0

async function offset($: EngineInterface): Promise<number> {
  if (offsetMinutes === undefined) {
    const zone = (await $.process.run(['date', '+%z'])).stdout.trim()
    const match = /^([+-])(\d{2})(\d{2})$/.exec(zone)
    offsetMinutes = match === null ? 0 : (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
  }

  return offsetMinutes
}

async function today($: EngineInterface): Promise<string> {
  return localDate(await $.clock.now(), await offset($))
}

async function home($: EngineInterface): Promise<string> {
  return (await $.env.get('HOME')) ?? ''
}

async function setStatus($: EngineInterface, next: Status): Promise<void> {
  await update($, status, () => next)
}

async function cached($: EngineInterface, window: JournalWindow, now: number): Promise<Review | undefined> {
  const review = (await $.store.get(`review:${fileStem(window)}`)) as Review | undefined
  if (review === undefined) {
    return undefined
  }

  return isComplete(window, await today($)) || now - review.generatedAt < FRESH_MS ? review : undefined
}

async function remember($: EngineInterface, review: Review): Promise<void> {
  const key = `review:${fileStem(review.window)}`
  await $.store.set(key, review)
  const keys = ((await $.store.get('reviews')) as string[] | undefined) ?? []
  const kept = [...keys.filter(one => one !== key), key]
  for (const old of kept.slice(0, Math.max(0, kept.length - CACHE_LIMIT))) {
    await $.store.delete(old)
  }
  await $.store.set('reviews', kept.slice(-CACHE_LIMIT))
}

async function summarizeProject($: EngineInterface, project: ProjectEntries, window: JournalWindow, zone: number): Promise<ProjectReview> {
  const base = emptyProject(project)
  const request = summaryRequest(project, window, zone)
  if (request === null) {
    return { ...base, summary: 'Only commands and short replies in this window.' }
  }

  const reply = await $.model.complete({ model: settings.model, ...request, maxTokens: 6000, timeoutMs: 120_000 })
  if (!reply.isAnswered) {
    return { ...base, summary: `Couldn't summarize (${reply.reason}).` }
  }

  const parsed = parseReply(reply.text)
  if (parsed === null) {
    const path = `${await home($)}/.claude/work-journal/debug/${fileStem(window)}-${project.name}.txt`
    await $.fs.write(path, `output tokens: ${reply.usage.output_tokens}\n\n${reply.text}`).catch(() => undefined)

    return { ...base, summary: `Couldn't read the summary the model wrote. Its answer is saved in ${path}` }
  }

  return { ...base, summary: parsed.summary, threads: parsed.threads.slice(0, threadLimit(window)) }
}

async function build($: EngineInterface, window: JournalWindow): Promise<Review> {
  const zone = await offset($)
  const { from, to } = bounds(window, zone)
  const ran = await $.process.run([...filterScript(from, to), `${await home($)}/.claude/history.jsonl`], { timeoutMs: 20_000 })
  if (ran.exitCode !== 0) {
    throw new Error(ran.stderr.trim() || 'Could not read ~/.claude/history.jsonl')
  }

  const entries = parseHistory(ran.stdout, settings.excluded)
  const projects = groupByProject(entries)
  const summarized = await Promise.all(projects.slice(0, MAX_PROJECTS).map(project => summarizeProject($, project, window, zone)))
  const lead = summarized[0]

  return {
    window,
    generatedAt: await $.clock.now(),
    prompts: entries.length,
    activeMinutes: activeMinutes(entries),
    headline: lead === undefined ? 'No prompts in this window.' : lead.summary,
    activity: activity(entries, window, zone),
    projects: summarized,
    skippedProjects: projects.slice(MAX_PROJECTS).map(project => ({ name: project.name, prompts: project.entries.length })),
  }
}

async function load($: EngineInterface, window: JournalWindow, isForced: boolean): Promise<Review | undefined> {
  const token = ++loadToken
  await update($, view, () => window)
  const hit = isForced ? undefined : await cached($, window, await $.clock.now())
  if (hit !== undefined) {
    await update($, current, () => hit)
    await setStatus($, { phase: 'ready' })

    return hit
  }

  await setStatus($, { phase: 'loading', message: `Summarizing ${window.label}…` })
  try {
    const review = await build($, window)
    if (token !== loadToken) {
      return undefined
    }
    if (!review.projects.some(project => project.summary.startsWith("Couldn't"))) {
      await remember($, review)
    }
    await update($, current, () => review)
    await setStatus($, { phase: 'ready' })

    return review
  } catch (error) {
    if (token === loadToken) {
      await setStatus($, { phase: 'error', message: error instanceof Error ? error.message : String(error) })
    }

    return undefined
  }
}

async function openWeb($: EngineInterface, review: Review): Promise<string> {
  const path = `${await home($)}/.claude/work-journal/${fileStem(review.window)}.html`
  await $.fs.write(path, renderHtml(review))
  const isMac = (await $.process.run(['uname'])).stdout.trim() === 'Darwin'
  await $.process.run([isMac ? 'open' : 'xdg-open', path]).catch(() => undefined)

  return path
}

async function showWeb($: EngineInterface, review: Review): Promise<void> {
  $.ui.toast(`Work journal saved to ${await openWeb($, review)}`)
}

function fail($: EngineInterface, error: unknown): void {
  setStatus($, { phase: 'error', message: error instanceof Error ? error.message : String(error) }).catch(() => undefined)
}

function show($: EngineInterface, window: JournalWindow, isForced: boolean, isWeb: boolean): void {
  $.clock.after(0, () => {
    load($, window, isForced)
      .then(review => (isWeb && review !== undefined ? showWeb($, review) : undefined))
      .catch(error => fail($, error))
  })
}

function openPage($: EngineInterface, review: Review): void {
  $.clock.after(0, () => {
    showWeb($, review).catch(error => fail($, error))
  })
}

export const register: Register = (on, options) => {
  settings.excluded = String(options.excludeProjects ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '')
  settings.model = String(options.model ?? 'opus') || 'opus'

  on('session.start', async ($, e, next) => {
    await $.command
      .register({
        name: 'journal',
        description: 'Review your work: today, a week or a month, summarized from your prompts',
        argumentHint: '[today|yesterday|week|last week|month|last month|YYYY-MM-DD] [web]',
      })
      .catch(() => $.ui.toast('work-journal: could not register /journal'))

    return next(e)
  })

  on('command.run', { command: 'journal' }, async ($, e) => {
    const parsed = parseArgs(e.args, await today($))
    if ('error' in parsed) {
      return { text: parsed.error }
    }

    await update($, view, () => parsed.window)
    await $.ui.open({ id: PANE, title: 'Work journal', focus: true, closeOnEscape: true })
    show($, parsed.window, false, parsed.isWeb)

    return { text: `Work journal: ${parsed.window.label}${parsed.isWeb ? ' (opening the webpage when it is ready)' : ''}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const window = await read($, view)
    const review = await read($, current)
    const state = await read($, status)
    const width = Math.max(30, e.props.bodyColumns)

    const go = (next: JournalWindow, isForced = false) => () => show($, next, isForced, false)
    const anchor = window?.start ?? (await today($))
    const controls = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1}>
        <Button key="day" hotkey="d" plain label="Day" onPress={go(windowFor('day', anchor))} />
        <Button key="week" hotkey="w" plain label="Week" onPress={go(windowFor('week', anchor))} />
        <Button key="month" hotkey="m" plain label="Month" onPress={go(windowFor('month', anchor))} />
        {window !== null ? <Button key="prev" hotkey="p" plain label="◀ Prev" onPress={go(shiftWindow(window, -1))} /> : null}
        {window !== null ? <Button key="next" hotkey="n" plain label="Next ▶" onPress={go(shiftWindow(window, 1))} /> : null}
        {window !== null ? <Button key="refresh" hotkey="r" plain label="Refresh" onPress={go(window, true)} /> : null}
        {review !== null ? (
          <Button
            key="web"
            hotkey="o"
            plain
            label="Open as webpage"
            onPress={() => openPage($, review)}
          />
        ) : null}
      </Box>
    )

    if (window === null) {
      return (
        <Box flexDirection="column">
          <Text>Type /journal, /journal week or /journal month.</Text>
          {controls}
        </Box>
      )
    }

    const header = (
      <Box flexDirection="column">
        <Text>
          <Text bold>📓 Work journal</Text>
          <Text dimColor> · {KIND_TITLE[window.kind]} review</Text>
        </Text>
        <Text bold color="claude">
          {window.label}
        </Text>
      </Box>
    )

    if (state.phase === 'loading' || state.phase === 'error' || review === null || review.window.start !== window.start || review.window.kind !== window.kind) {
      return (
        <Box flexDirection="column">
          {header}
          <Box marginTop={1}>
            {state.phase === 'error' ? (
              <Text color="error">Couldn't build this review: {state.message ?? 'unknown error'}</Text>
            ) : (
              <Text dimColor>⋯ Reading your prompts and summarizing them. A month can take a minute.</Text>
            )}
          </Box>
          {controls}
        </Box>
      )
    }

    const peak = Math.max(1, ...review.activity.map(bucket => bucket.count))
    const barRoom = Math.max(8, Math.min(40, width - 14))
    const chart =
      review.window.kind === 'week' ? (
        <Box flexDirection="column">
          {review.activity.map(bucket => (
            <Text>
              <Text dimColor>{bucket.label.padEnd(4)}</Text>
              <Text color="#6d8cf5">{'█'.repeat(Math.round((bucket.count / peak) * barRoom))}</Text>
              <Text dimColor> {bucket.count > 0 ? bucket.count : ''}</Text>
            </Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color="#6d8cf5">{sparkline(review.activity)}</Text>
          <Text dimColor>
            {review.window.kind === 'day'
              ? '0     6     12    18   23h'
              : `1${' '.repeat(Math.max(1, review.activity.length - 1 - String(review.activity.length).length))}${review.activity.length}`}
          </Text>
        </Box>
      )

    return (
      <Box flexDirection="column">
        {header}
        <Text dimColor>
          {plural(review.prompts, 'prompt')} · {plural(review.projects.length + review.skippedProjects.length, 'project')} · ~{formatMinutes(review.activeMinutes)} active
        </Text>
        {review.headline === '' ? null : (
          <Box marginTop={1}>
            <Text italic>{review.headline}</Text>
          </Box>
        )}
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Prompts per {review.window.kind === 'day' ? 'hour' : 'day'}</Text>
          {chart}
        </Box>
        {review.projects.map((project, index) => {
          const color = PROJECT_COLORS[index % PROJECT_COLORS.length] ?? '#6d8cf5'

          return (
            <Box key={`project-${index}`} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} marginTop={1}>
              <Text>
                <Text color={color} bold>
                  ● {project.name}
                </Text>
                <Text dimColor>
                  {'  '}
                  {plural(project.prompts, 'prompt')} · ~{formatMinutes(project.activeMinutes)}
                </Text>
              </Text>
              {project.summary === '' ? null : <Text dimColor>{project.summary}</Text>}
              {project.threads.map(thread => (
                <Box flexDirection="column" marginTop={1}>
                  <Text>
                    <Text color={color}>▸ </Text>
                    <Text bold>{thread.title}</Text>
                    <Text dimColor> ({thread.prompts})</Text>
                  </Text>
                  {thread.goal === '' ? null : <Text dimColor>{`  ${thread.goal}`}</Text>}
                  {thread.decisions.map(decision => (
                    <Text>
                      <Text color="success">{'  ✓ '}</Text>
                      {decision}
                    </Text>
                  ))}
                  {thread.open.map(item => (
                    <Text>
                      <Text color="warning">{'  ○ '}</Text>
                      {item}
                    </Text>
                  ))}
                </Box>
              ))}
            </Box>
          )
        })}
        {review.skippedProjects.length === 0 ? null : (
          <Text dimColor>Also active: {review.skippedProjects.map(project => `${project.name} (${project.prompts})`).join(', ')}</Text>
        )}
        {controls}
      </Box>
    )
  })
}
