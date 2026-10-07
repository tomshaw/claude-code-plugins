import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

import type { Corrections } from '../types'

const corrections = atom({ plugin: 'proofread', key: 'corrections' } as const, {})
const MAX_REMEMBERED = 50
const ACCENT = 'suggestion'
const FIX = 'success'

const MODEL = 'haiku'
const MAX_LENGTH = 4000
const MIN_WORDS = 3

const SYSTEM = `You are a proofreader. The user message is a prompt someone typed to a coding assistant.
Fix only spelling, typos and clear grammar mistakes. Do not rephrase, reword, shorten, expand, change tone, or answer it.
Leave untouched: code, code blocks, inline code, file paths, URLs, identifiers, class/function/variable names, CLI commands, slang, technical jargon, product names, and markdown.
Reply with the corrected prompt text only, nothing else. If nothing needs fixing, reply with the text exactly as given.`

const isHuman = (origin: PromptOrigin | undefined): boolean =>
  origin === undefined ||
  origin.kind === 'composer' ||
  origin.kind === 'bridge' ||
  (origin.kind === 'plugin' && origin.asUser === true)

const shouldCheck = (text: string): boolean => {
  const trimmed = text.trim()

  return (
    trimmed.length <= MAX_LENGTH &&
    !trimmed.startsWith('/') &&
    !trimmed.startsWith('!') &&
    trimmed.split(/\s+/).length >= MIN_WORDS
  )
}

const words = (text: string): string[] => text.split(/\s+/).filter(word => word !== '')

const changedPositions = (before: string, after: string): number[] => {
  const a = words(before)
  const b = words(after)
  const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lengths[i]!
      row[j] = a[i] === b[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, row[j + 1]!)
    }
  }

  const changed: number[] = []
  let i = 0
  let j = 0
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      i++
      j++
    } else if (i < a.length && lengths[i + 1]![j]! >= lengths[i]![j + 1]!) {
      i++
    } else {
      changed.push(j)
      j++
    }
  }

  return changed
}

const OFF_KEY = 'isOff'
const OFF_STATUS = 'proofread: off'

const isOff = async ($: EngineInterface): Promise<boolean> => (await $.store.get(OFF_KEY)) === true

const setOff = async ($: EngineInterface, off: boolean): Promise<void> => {
  await $.store.set(OFF_KEY, off)
  $.ui.status(off ? OFF_STATUS : undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command
      .register({
        name: 'proofread',
        description: 'Turn prompt proofreading on or off',
        argumentHint: '[on|off|status]',
        immediate: true,
      })
      .catch(() => $.ui.toast('proofread: could not register /proofread'))
    $.ui.status((await isOff($)) ? OFF_STATUS : undefined)

    return next(e)
  })

  on('command.run', { command: 'proofread' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const wasOff = await isOff($)

    if (arg === 'status') {
      return { text: `Proofreading is ${wasOff ? 'off' : 'on'}.` }
    }

    const off = arg === 'off' ? true : arg === 'on' ? false : !wasOff
    await setOff($, off)

    return { text: `Proofreading is now ${off ? 'off' : 'on'}.` }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!isHuman(e.origin) || e.turnId !== undefined || !shouldCheck(e.text) || (await isOff($))) {
      return next(e)
    }

    $.ui.status('proofread: checking…')
    const reply = await $.model.complete({
      model: MODEL,
      system: SYSTEM,
      prompt: e.text,
      maxTokens: Math.ceil(e.text.length / 2) + 256,
      timeoutMs: 8000,
    })
    $.ui.status(undefined)

    if (!reply.isAnswered) {
      return next(e)
    }

    const corrected = reply.text.trim()
    const ratio = corrected.length / e.text.trim().length

    if (corrected === e.text.trim() || ratio < 0.8 || ratio > 1.2) {
      return next(e)
    }

    const positions = changedPositions(e.text, corrected)
    const correctedWords = words(corrected)
    const fixes = positions.map(position => correctedWords[position] ?? '')
    await update($, corrections, (all: Corrections) => {
      const kept = Object.entries(all).slice(-(MAX_REMEMBERED - 1))

      return Object.fromEntries([...kept, [corrected, positions]])
    })
    $.ui.toast(
      fixes.length > 0
        ? `proofread fixed: ${fixes.slice(0, 6).join(', ')}${fixes.length > 6 ? '…' : ''}`
        : 'proofread fixed punctuation',
    )

    return next({ ...e, text: corrected })
  }).catch(async ($, e, next) => {
    $.ui.status((await isOff($)) ? OFF_STATUS : undefined)

    return next(e)
  })

  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'composer' } } }, async ($, e, next) => {
    const text = e.props.text.trim()
    const { Box, Text } = $.ui.resolve(e)
    const fixes = (await read($, corrections))[text]
    const fixed = new Set(fixes ?? [])
    let position = -1

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={1}>
        <Text>
          <Text color={ACCENT} bold>
            {'❯ '}
          </Text>
          {text.split(/(\s+)/).map(part =>
            part.trim() !== '' && fixed.has(++position) ? (
              <Text color={FIX} bold underline>
                {part}
              </Text>
            ) : (
              part
            ),
          )}
        </Text>
        {fixes !== undefined ? (
          <Text dimColor>
            ✓ proofread fixed {fixes.length > 0 ? fixes.length : 'punctuation'}
            {fixes.length === 1 ? ' word' : fixes.length > 1 ? ' words' : ''}
          </Text>
        ) : null}
      </Box>
    )
  })
}
