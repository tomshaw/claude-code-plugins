export type Style = 'simple' | 'body' | 'full'

export type Draft = { style: Style; subject: string; body: string[]; footer: string[] }

export type Phase = 'idle' | 'writing' | 'ready' | 'error'

export type Composer = {
  phase: Phase
  style: Style
  note: string
  scope: string
  error: string
  drafts: Draft[]
  index: number
  isEditing: boolean
  copiedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'commit-msg': { composer: Composer }
  }
}
