export type Corrections = Record<string, readonly number[]>

declare module 'claude-code' {
  interface PluginState {
    proofread: { corrections: Corrections }
  }
}
