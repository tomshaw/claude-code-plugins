import { expect, mock, test } from 'claude-code/testing'

const COMMAND = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }
const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

test('corrects a misspelled prompt before it reaches the model', async ($, on) => {
  mock.store(on)
  on('model.complete', () => ({ value: { isAnswered: true as const, text: 'Can you check spelling and grammar in my prompt?', usage } }))
  let received = ''
  on('prompt.submit', (_, e) => {
    received = e.text

    return { text: e.text }
  })

  await $.prompt.submit({ text: 'Can you chek speling and grammer in my prompt?', wait: false, origin: { kind: 'composer' } })

  expect(received).toBe('Can you check spelling and grammar in my prompt?')
})

test('passes the prompt through when the reply is not a correction', async ($, on) => {
  mock.store(on)
  on('model.complete', () => ({ value: { isAnswered: true as const, text: 'Sure! Here is a long answer to your question instead of a corrected prompt.', usage } }))
  let received = ''
  on('prompt.submit', (_, e) => {
    received = e.text

    return { text: e.text }
  })

  await $.prompt.submit({ text: 'fix the bug in teh login page', wait: false, origin: { kind: 'composer' } })

  expect(received).toBe('fix the bug in teh login page')
})

test('skips slash commands', async ($, on) => {
  mock.store(on)
  let calls = 0
  on('model.complete', () => {
    calls += 1

    return { value: { isAnswered: true as const, text: 'x', usage } }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await $.prompt.submit({ text: '/code-review hgih effort please', wait: false, origin: { kind: 'composer' } })

  expect(calls).toBe(0)
})

test('draws a corrected prompt with its fixes called out on every surface', async ($, on) => {
  mock.store(on)
  on('model.complete', () => ({ value: { isAnswered: true as const, text: 'fix the bug in the login page', usage } }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'fix the bug in teh login page', wait: false, origin: { kind: 'composer' } })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'proofread',
      surface,
      component: 'UserMessage',
      props: { text: 'fix the bug in the login page', origin: { kind: 'composer' }, isExpanded: false },
    })
    expect(await ui.find({ type: 'Text', text: /proofread fixed 1 word$/ })).toBeDefined()
    const highlighted = (await ui.findAll({ type: 'Text' })).filter(node => node.props.underline === true)
    expect(highlighted.map(node => node.text)).toEqual(['the'])
    await ui.unmount()
  }
})

test('/proofread off leaves prompts untouched until turned back on', async ($, on) => {
  mock.store(on)
  let calls = 0
  on('model.complete', () => {
    calls += 1

    return { value: { isAnswered: true as const, text: 'fix the bug in the login page', usage } }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))

  expect((await $.command.run({ ...COMMAND, command: 'proofread', args: 'off' })).text).toBe('Proofreading is now off.')
  await $.prompt.submit({ text: 'fix the bug in teh login page', wait: false, origin: { kind: 'composer' } })
  expect(calls).toBe(0)

  expect((await $.command.run({ ...COMMAND, command: 'proofread', args: '' })).text).toBe('Proofreading is now on.')
  await $.prompt.submit({ text: 'fix the bug in teh login page', wait: false, origin: { kind: 'composer' } })
  expect(calls).toBe(1)
})
