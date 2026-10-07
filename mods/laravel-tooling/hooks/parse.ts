import type { CheckResult, Issue } from '../types'

type Parsed = Pick<CheckResult, 'status' | 'summary' | 'issues'>

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

export const relativeTo = (root: string, path: string): string => {
  const base = root.endsWith('/') ? root : `${root}/`

  return path.startsWith(base) ? path.slice(base.length) : path
}

const firstJsonObject = (text: string): unknown => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) {
    return undefined
  }
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

const failure = (summary: string, stderr: string): Parsed => ({
  status: 'error',
  summary,
  issues: stderr.trim() === '' ? [] : [{ file: '', message: stderr.trim().split('\n').slice(0, 6).join('\n') }],
})

type PintJson = { result?: string; files?: { path: string; fixers?: string[] }[] }

export const parsePint = (stdout: string, stderr: string, root: string): Parsed => {
  const json = firstJsonObject(stdout) as PintJson | undefined
  if (json === undefined || json.result === undefined) {
    return failure('Pint did not report', stderr || stdout)
  }

  const files = json.files ?? []
  if (files.length === 0) {
    return { status: 'pass', summary: 'clean', issues: [] }
  }

  const verb = json.result === 'fail' ? 'needs' : 'fixed'

  return {
    status: json.result === 'fail' ? 'fail' : 'pass',
    summary: `${verb} ${plural(files.length, 'file')}`,
    issues: files.map(file => ({
      file: relativeTo(root, file.path),
      message: (file.fixers ?? []).join(', '),
    })),
  }
}

type StanJson = {
  totals?: { errors: number; file_errors: number }
  files?: Record<string, { messages: { message: string; line?: number | null }[] }>
  errors?: string[]
}

export const parsePhpstan = (stdout: string, stderr: string, root: string): Parsed => {
  const json = firstJsonObject(stdout) as StanJson | undefined
  if (json === undefined || json.totals === undefined) {
    return failure('Larastan did not report', stderr || stdout)
  }

  const issues: Issue[] = [
    ...(json.errors ?? []).map(message => ({ file: '', message })),
    ...Object.entries(json.files ?? {}).flatMap(([path, file]) =>
      file.messages.map(item => ({
        file: relativeTo(root, path),
        line: item.line ?? undefined,
        message: item.message,
      })),
    ),
  ]
  const count = json.totals.file_errors + json.totals.errors
  if (count === 0) {
    return { status: 'pass', summary: 'no errors', issues: [] }
  }

  const files = Object.keys(json.files ?? {}).length

  return {
    status: 'fail',
    summary: files > 0 ? `${plural(count, 'error')} in ${plural(files, 'file')}` : plural(count, 'error'),
    issues,
  }
}

const unescapeTeamcity = (value: string): string =>
  value.replace(/\|(['nr|\[\]])/g, (_, char: string) =>
    char === 'n' ? '\n' : char === 'r' ? '' : char,
  )

const attributes = (line: string): Record<string, string> => {
  const found: Record<string, string> = {}
  for (const match of line.matchAll(/(\w+)='((?:\|.|[^'|])*)'/g)) {
    found[match[1]!] = unescapeTeamcity(match[2]!)
  }

  return found
}

const LOCATION = /((?:tests|app|routes|database)\/[^\s:]+\.php):(\d+)/

export const parseTests = (stdout: string, stderr: string): Parsed => {
  let passed = 0
  let skipped = 0
  const issues: Issue[] = []
  let failing = new Set<string>()

  for (const piece of stdout.split('##teamcity[').slice(1)) {
    const line = piece.split('\n')[0] ?? ''
    const event = line.match(/^(\w+)/)?.[1]
    if (event === undefined) {
      continue
    }
    const fields = attributes(line)
    const name = fields.name ?? ''

    if (event === 'testFailed') {
      failing.add(name)
      const location = (fields.details ?? '').match(LOCATION) ?? (fields.locationHint ?? '').match(LOCATION)
      const hintFile = (fields.locationHint ?? '').replace(/^pest_qn:\/\//, '').split('::')[0] ?? ''
      issues.push({
        file: location?.[1] ?? hintFile,
        line: location?.[2] === undefined ? undefined : Number(location[2]),
        message: `${name}: ${(fields.message ?? '').trim()}`,
      })
    } else if (event === 'testIgnored') {
      skipped += 1
      failing.add(name)
    } else if (event === 'testFinished' && !failing.has(name)) {
      passed += 1
    } else if (event === 'testSuiteFinished') {
      failing = new Set()
    }
  }

  const failed = issues.length
  const total = passed + failed
  if (total === 0 && skipped === 0) {
    return failure('no tests ran', stderr || stdout.split('\n').slice(-8).join('\n'))
  }

  const tail = skipped > 0 ? `, ${skipped} skipped` : ''

  return failed === 0
    ? { status: 'pass', summary: `${passed}/${total} passed${tail}`, issues: [] }
    : { status: 'fail', summary: `${plural(failed, 'failure')}, ${passed}/${total} passed${tail}`, issues }
}
