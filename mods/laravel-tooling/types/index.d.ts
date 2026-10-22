export type CheckName = 'pint' | 'phpstan' | 'tests'

export type CheckStatus = 'idle' | 'running' | 'pass' | 'fail' | 'error'

export type Issue = { file: string; line?: number; message: string }

export type CheckResult = {
  status: CheckStatus
  summary: string
  issues: Issue[]
  durationMs: number
  ranAt: number
}

export type Checks = Record<CheckName, CheckResult>

declare module 'claude-code' {
  interface PluginState {
    'laravel-tooling': { checks: Checks; pending: string[] }
  }
}
