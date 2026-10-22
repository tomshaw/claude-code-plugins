import { describe, expect, mock, test } from 'claude-code/testing'

import { activeMinutes, activity, groupByProject, parseHistory, promptsForModel } from '../hooks/history'
import { escapeHtml, renderHtml } from '../hooks/html'
import { sparkline } from '../hooks/register'
import { parseReply } from '../hooks/summarize'
import { bounds, parseArgs, shiftWindow, windowFor } from '../hooks/window'

const OFFSET = -300
const NOW = Date.UTC(2026, 9, 7, 19, 0)
const at = (hour: number, minute = 0) => Date.UTC(2026, 9, 7, hour + 5, minute)
const line = (display: string, timestamp: number, project = '/Users/me/Sites/acme-shop') => JSON.stringify({ display, pastedContents: {}, timestamp, project, sessionId: 's1' })

const HISTORY = [
  line('Add a checkout wizard with an address picker', at(9)),
  line('Lock the shipping country field as read-only in the wizard', at(9, 20)),
  line('yes', at(9, 25)),
  line('/reload-plugins', at(9, 26)),
  line('Rename the settings page to preferences and push it', at(13), '/Users/me/Projects/notes-app'),
  line('secret client work for acme corp today', at(14), '/Users/me/acme-secret'),
].join('\n')

const REPLY = JSON.stringify({
  summary: 'Built the checkout wizard.',
  threads: [{ title: 'Checkout wizard', goal: 'Let shoppers check out in one flow.', decisions: ['Shipping country is read-only'], open: ['Address picker validation'], prompts: 2 }],
})

const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
const PANE = { component: 'Pane', requestId: 'work-journal', props: { title: 'Work journal', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as const
const COMMAND = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 160 } }

describe('windows', () => {
  test('a week runs Monday to Sunday and shifts by seven days', () => {
    const week = windowFor('week', '2026-10-07')
    expect(week).toEqual({ kind: 'week', start: '2026-10-05', end: '2026-10-11', label: 'Week of Oct 5 – Oct 11, 2026' })
    expect(shiftWindow(week, -1).start).toBe('2026-09-28')
  })

  test('a month covers every day and steps across year ends', () => {
    expect(windowFor('month', '2026-02-14')).toMatchObject({ start: '2026-02-01', end: '2026-02-28', label: 'February 2026' })
    expect(shiftWindow(windowFor('month', '2026-12-03'), 1).start).toBe('2027-01-01')
  })

  test('arguments pick the window and the web flag', () => {
    expect(parseArgs('', '2026-10-07')).toMatchObject({ window: { kind: 'day', start: '2026-10-07' }, isWeb: false })
    expect(parseArgs('last week web', '2026-10-07')).toMatchObject({ window: { start: '2026-09-28', end: '2026-10-04' }, isWeb: true })
    expect(parseArgs('this month', '2026-10-07')).toMatchObject({ window: { kind: 'month', start: '2026-10-01' } })
    expect(parseArgs('2026-09', '2026-10-07')).toMatchObject({ window: { kind: 'month', end: '2026-09-30' } })
    expect('error' in parseArgs('fortnight', '2026-10-07')).toBe(true)
  })

  test('bounds start at local midnight', () => {
    expect(bounds(windowFor('day', '2026-10-07'), OFFSET)).toEqual({ from: Date.UTC(2026, 9, 7, 5), to: Date.UTC(2026, 9, 8, 5) })
  })
})

describe('history', () => {
  test('parses prompts, skips excluded projects and groups the rest', () => {
    const entries = parseHistory(`${HISTORY}\nnot json`, ['secret'])
    expect(entries).toHaveLength(5)
    expect(groupByProject(entries).map(group => [group.name, group.entries.length])).toEqual([
      ['acme-shop', 4],
      ['notes-app', 1],
    ])
  })

  test('counts active time with long gaps as a lone prompt', () => {
    expect(activeMinutes(parseHistory(HISTORY, ['secret']))).toBe(26 + 5 + 5)
  })

  test('buckets a day by local hour and keeps only real prompts for the model', () => {
    const entries = parseHistory(HISTORY, ['secret'])
    expect(activity(entries, windowFor('day', '2026-10-07'), OFFSET)[9]?.count).toBe(4)
    const forModel = promptsForModel(entries, 50, OFFSET)
    expect(forModel).toContain('[2026-10-07 09h] Add a checkout wizard')
    expect(forModel).not.toContain('/reload-plugins')
    expect(forModel.split('\n')).toHaveLength(3)
  })

  test('samples evenly when there are more prompts than the limit', () => {
    const many = Array.from({ length: 100 }, (_, index) => line(`prompt number ${index} about the wizard`, at(10) + index * 1000)).join('\n')
    const picked = promptsForModel(parseHistory(many, []), 10, OFFSET).split('\n')
    expect(picked).toHaveLength(10)
    expect(picked[1]).toContain('prompt number 10 ')
  })
})

describe('output', () => {
  test('reads a JSON reply wrapped in prose or a fence', () => {
    expect(parseReply(`Here you go:\n\`\`\`json\n${REPLY}\n\`\`\``)?.threads[0]?.decisions).toEqual(['Shipping country is read-only'])
    expect(parseReply('no json here')).toBeNull()
  })

  test('repairs trailing commas and raw line breaks inside strings', () => {
    const sloppy = '{"summary": "Two\nlines", "threads": [{"title": "Wizard", "goal": "g", "decisions": ["a",], "open": [], "prompts": 3,},],}'
    expect(parseReply(sloppy)).toEqual({ summary: 'Two\nlines', threads: [{ title: 'Wizard', goal: 'g', decisions: ['a'], open: [], prompts: 3 }] })
  })

  test('the webpage escapes what it shows', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
    const html = renderHtml({
      window: windowFor('day', '2026-10-07'),
      generatedAt: NOW,
      prompts: 1,
      activeMinutes: 5,
      headline: '<script>alert(1)</script>',
      activity: [{ label: '9', count: 1 }],
      projects: [],
      skippedProjects: [],
    })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
  })

  test('the sparkline scales to the busiest bucket', () => {
    expect(sparkline([{ label: 'a', count: 0 }, { label: 'b', count: 4 }, { label: 'c', count: 8 }])).toBe('·▄█')
  })
})

test('/journal web reads history, summarizes each project and draws it on every surface', async ($, on) => {
  mock.store(on)
  mock.env(on, { HOME: '/home/me' })
  const clock = mock.clock(on, { now: NOW })
  const ran: string[][] = []
  const written: string[] = []
  const toasts: string[] = []
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    const stdout = e.argv[0] === 'date' ? '-0500\n' : e.argv[0] === 'uname' ? 'Darwin\n' : e.argv[0] === 'awk' ? HISTORY : ''

    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('model.complete', () => ({ value: { isAnswered: true as const, text: REPLY, usage } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('fs.write', (_, e) => {
    written.push(e.path)

    return { value: undefined }
  })

  const result = await $.command.run({ ...COMMAND, command: 'journal', args: 'today web' })
  expect(result.text).toContain('Wed Oct 7, 2026')
  await clock.settle()

  const awk = ran.find(argv => argv[0] === 'awk') ?? []
  expect(awk).toContain(`from=${Date.UTC(2026, 9, 7, 5)}`)
  expect(awk.at(-1)).toBe('/home/me/.claude/history.jsonl')
  expect(written).toEqual(['/home/me/.claude/work-journal/day-2026-10-07.html'])
  expect(ran.some(argv => argv[0] === 'open')).toBe(true)
  expect(toasts[0]).toContain('day-2026-10-07.html')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'work-journal', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /Checkout wizard/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Address picker validation/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /6 prompts · 3 projects/ })).toBeDefined()
    await ui.unmount()
  }
})
