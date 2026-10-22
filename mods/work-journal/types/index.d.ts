export type WindowKind = 'day' | 'week' | 'month'

export type JournalWindow = {
  kind: WindowKind
  start: string
  end: string
  label: string
}

export type Thread = {
  title: string
  goal: string
  decisions: string[]
  open: string[]
  prompts: number
}

export type ProjectReview = {
  name: string
  path: string
  prompts: number
  activeMinutes: number
  summary: string
  threads: Thread[]
}

export type Bucket = { label: string; count: number }

export type Review = {
  window: JournalWindow
  generatedAt: number
  prompts: number
  activeMinutes: number
  headline: string
  activity: Bucket[]
  projects: ProjectReview[]
  skippedProjects: { name: string; prompts: number }[]
}

export type Status = { phase: 'idle' | 'loading' | 'ready' | 'error'; message?: string }

declare module 'claude-code' {
  interface PluginState {
    'work-journal': { view: JournalWindow | null; review: Review | null; status: Status }
  }
}
