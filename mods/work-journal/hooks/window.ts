import type { JournalWindow, WindowKind } from '../types'

const DAY_MS = 86_400_000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const parts = (date: string): [number, number, number] => {
  const [y, m, d] = date.split('-').map(Number)

  return [y ?? 1970, m ?? 1, d ?? 1]
}

const utc = (date: string): number => {
  const [y, m, d] = parts(date)

  return Date.UTC(y, m - 1, d)
}

const format = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export const addDays = (date: string, days: number): string => format(utc(date) + days * DAY_MS)

export const weekdayIndex = (date: string): number => (new Date(utc(date)).getUTCDay() + 6) % 7

export const weekdayName = (date: string): string => WEEKDAYS[weekdayIndex(date)] ?? ''

export const localDate = (ms: number, offsetMinutes: number): string => format(ms + offsetMinutes * 60_000)

export const localHour = (ms: number, offsetMinutes: number): number => new Date(ms + offsetMinutes * 60_000).getUTCHours()

const short = (date: string): string => {
  const [, m, d] = parts(date)

  return `${MONTHS[m - 1]} ${d}`
}

const labelFor = (kind: WindowKind, start: string, end: string): string => {
  const [y, m] = parts(start)
  if (kind === 'day') {
    return `${weekdayName(start)} ${short(start)}, ${y}`
  }
  if (kind === 'week') {
    return `Week of ${short(start)} – ${short(end)}, ${parts(end)[0]}`
  }

  return `${MONTH_NAMES[m - 1]} ${y}`
}

export const windowFor = (kind: WindowKind, anchor: string): JournalWindow => {
  let start = anchor
  let end = anchor
  if (kind === 'week') {
    start = addDays(anchor, -weekdayIndex(anchor))
    end = addDays(start, 6)
  }
  if (kind === 'month') {
    const [y, m] = parts(anchor)
    start = format(Date.UTC(y, m - 1, 1))
    end = format(Date.UTC(y, m, 0))
  }

  return { kind, start, end, label: labelFor(kind, start, end) }
}

export const shiftWindow = (window: JournalWindow, direction: 1 | -1): JournalWindow => {
  if (window.kind === 'day') {
    return windowFor('day', addDays(window.start, direction))
  }
  if (window.kind === 'week') {
    return windowFor('week', addDays(window.start, 7 * direction))
  }

  return windowFor('month', direction === 1 ? addDays(window.end, 1) : addDays(window.start, -1))
}

export const bounds = (window: JournalWindow, offsetMinutes: number): { from: number; to: number } => ({
  from: utc(window.start) - offsetMinutes * 60_000,
  to: utc(addDays(window.end, 1)) - offsetMinutes * 60_000,
})

export const isComplete = (window: JournalWindow, today: string): boolean => window.end < today

export const daysIn = (window: JournalWindow): string[] => {
  const days: string[] = []
  for (let day = window.start; day <= window.end; day = addDays(day, 1)) {
    days.push(day)
  }

  return days
}

export const fileStem = (window: JournalWindow): string => `${window.kind}-${window.start}`

export type ParsedArgs = { window: JournalWindow; isWeb: boolean } | { error: string }

export const parseArgs = (args: string, today: string): ParsedArgs => {
  const words = args.toLowerCase().trim().split(/\s+/).filter(word => word !== '')
  const isWeb = words.includes('web')
  const rest = words.filter(word => word !== 'web' && word !== 'this').join(' ')

  const named: Record<string, JournalWindow> = {
    '': windowFor('day', today),
    today: windowFor('day', today),
    day: windowFor('day', today),
    daily: windowFor('day', today),
    yesterday: windowFor('day', addDays(today, -1)),
    week: windowFor('week', today),
    weekly: windowFor('week', today),
    'last week': shiftWindow(windowFor('week', today), -1),
    month: windowFor('month', today),
    monthly: windowFor('month', today),
    'last month': shiftWindow(windowFor('month', today), -1),
  }

  const window = named[rest]
  if (window !== undefined) {
    return { window, isWeb }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(rest) && !Number.isNaN(utc(rest))) {
    return { window: windowFor('day', rest), isWeb }
  }
  if (/^\d{4}-\d{2}$/.test(rest)) {
    return { window: windowFor('month', `${rest}-01`), isWeb }
  }

  return { error: `Unknown window "${rest}". Try: today, yesterday, week, last week, month, last month, a date (2026-10-05) or a month (2026-09), plus "web".` }
}
