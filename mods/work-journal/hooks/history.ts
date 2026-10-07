import type { Bucket, JournalWindow } from '../types'
import { daysIn, localDate, localHour, weekdayName } from './window'

export type Entry = { text: string; at: number; project: string; session: string }

export type ProjectEntries = { name: string; path: string; entries: Entry[] }

const IDLE_GAP_MS = 30 * 60_000
const LONE_PROMPT_MINUTES = 5
const MAX_PROMPT_CHARS = 240

export const filterScript = (from: number, to: number): string[] => [
  'awk',
  '-v',
  `from=${from}`,
  '-v',
  `to=${to}`,
  'match($0, /"timestamp":[0-9]+/) { t = substr($0, RSTART + 12, RLENGTH - 12) + 0; if (t >= from && t < to) print }',
]

export const parseHistory = (jsonl: string, excluded: readonly string[]): Entry[] =>
  jsonl
    .split('\n')
    .flatMap(line => {
      if (line.trim() === '') {
        return []
      }
      try {
        const row = JSON.parse(line) as { display?: unknown; timestamp?: unknown; project?: unknown; sessionId?: unknown }
        const text = typeof row.display === 'string' ? row.display.trim() : ''
        const project = typeof row.project === 'string' ? row.project : ''
        if (text === '' || typeof row.timestamp !== 'number' || excluded.some(part => project.includes(part))) {
          return []
        }

        return [{ text, at: row.timestamp, project, session: typeof row.sessionId === 'string' ? row.sessionId : '' }]
      } catch {
        return []
      }
    })
    .sort((a, b) => a.at - b.at)

export const projectName = (path: string): string => path.split('/').filter(part => part !== '').pop() ?? (path || 'unknown')

export const groupByProject = (entries: readonly Entry[]): ProjectEntries[] => {
  const groups = new Map<string, Entry[]>()
  for (const entry of entries) {
    groups.set(entry.project, [...(groups.get(entry.project) ?? []), entry])
  }

  return [...groups.entries()]
    .map(([path, list]) => ({ name: projectName(path), path, entries: list }))
    .sort((a, b) => b.entries.length - a.entries.length)
}

export const activeMinutes = (entries: readonly Entry[]): number => {
  let minutes = 0
  let previous: number | undefined
  for (const at of entries.map(entry => entry.at).sort((a, b) => a - b)) {
    const gap = previous === undefined ? Infinity : at - previous
    minutes += gap <= IDLE_GAP_MS ? gap / 60_000 : LONE_PROMPT_MINUTES
    previous = at
  }

  return Math.round(minutes)
}

export const activity = (entries: readonly Entry[], window: JournalWindow, offsetMinutes: number): Bucket[] => {
  if (window.kind === 'day') {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ label: `${hour}`, count: 0 }))
    for (const entry of entries) {
      const bucket = hours[localHour(entry.at, offsetMinutes)]
      if (bucket !== undefined) {
        bucket.count += 1
      }
    }

    return hours
  }

  const days = daysIn(window).map(day => ({
    day,
    label: window.kind === 'week' ? weekdayName(day) : day.slice(8).replace(/^0/, ''),
    count: 0,
  }))
  for (const entry of entries) {
    const bucket = days.find(day => day.day === localDate(entry.at, offsetMinutes))
    if (bucket !== undefined) {
      bucket.count += 1
    }
  }

  return days.map(({ label, count }) => ({ label, count }))
}

const isWorthSummarizing = (text: string): boolean => !text.startsWith('/') && !text.startsWith('!') && text.split(/\s+/).length >= 4

export const promptsForModel = (entries: readonly Entry[], limit: number, offsetMinutes: number): string => {
  const useful = entries.filter(entry => isWorthSummarizing(entry.text))
  const step = useful.length / limit
  const picked = useful.length <= limit ? useful : Array.from({ length: limit }, (_, index) => useful[Math.floor(index * step)]).filter(entry => entry !== undefined)

  return picked
    .map(entry => {
      const stamp = `${localDate(entry.at, offsetMinutes)} ${String(localHour(entry.at, offsetMinutes)).padStart(2, '0')}h`
      const text = entry.text.replace(/\s+/g, ' ')

      return `[${stamp}] ${text.length > MAX_PROMPT_CHARS ? `${text.slice(0, MAX_PROMPT_CHARS)}…` : text}`
    })
    .join('\n')
}

export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}
