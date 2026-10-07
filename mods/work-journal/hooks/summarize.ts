import type { JournalWindow, ProjectReview, Thread } from '../types'
import type { ProjectEntries } from './history'
import { activeMinutes, promptsForModel } from './history'

const PROMPT_LIMIT: Record<JournalWindow['kind'], number> = { day: 150, week: 250, month: 350 }
const THREAD_LIMIT: Record<JournalWindow['kind'], number> = { day: 5, week: 6, month: 8 }

const SYSTEM = `You write a developer's work journal from the prompts they typed to an AI coding assistant in one project.
Group the prompts into threads: distinct pieces of work (a feature, a bug, a refactor, a question being researched). Name each thread in plain language, as a person would in a standup ("Material creation wizard", "Proofread mod for Claude Code"), never as a prompt or a commit prefix.
For each thread give:
- goal: one sentence, what they set out to do
- decisions: choices they clearly made (a name picked, an approach chosen, scope cut). Only what the prompts state. May be empty
- open: things they asked for that show no sign of being finished or revisited, or questions left hanging. May be empty
- prompts: how many of the listed prompts belong to it
Also write summary: one sentence on the project's work in this window.
Write in the past tense, plainly, without praise or judgement. Never invent work the prompts don't show. Ignore chit-chat and approvals ("yes", "go ahead").
Reply with JSON only, no prose and no code fence:
{"summary": "...", "threads": [{"title": "...", "goal": "...", "decisions": ["..."], "open": ["..."], "prompts": 0}]}`

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(item => item.trim()) : []

const repair = (json: string): string =>
  json
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/"(?:[^"\\]|\\.)*"/g, quoted => quoted.replace(/\n/g, '\\n').replace(/\t/g, '\\t'))

const parseJson = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return JSON.parse(repair(json))
  }
}

export const parseReply = (text: string): { summary: string; threads: Thread[] } | null => {
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  try {
    const reply = parseJson(json) as { summary?: unknown; threads?: unknown }
    const threads = (Array.isArray(reply.threads) ? reply.threads : []).flatMap((raw: unknown): Thread[] => {
      const thread = (raw ?? {}) as Record<string, unknown>
      if (typeof thread.title !== 'string' || thread.title.trim() === '') {
        return []
      }

      return [
        {
          title: thread.title.trim(),
          goal: typeof thread.goal === 'string' ? thread.goal.trim() : '',
          decisions: strings(thread.decisions),
          open: strings(thread.open),
          prompts: typeof thread.prompts === 'number' ? Math.max(0, Math.round(thread.prompts)) : 0,
        },
      ]
    })

    return { summary: typeof reply.summary === 'string' ? reply.summary.trim() : '', threads }
  } catch {
    return null
  }
}

export const emptyProject = (project: ProjectEntries): ProjectReview => ({
  name: project.name,
  path: project.path,
  prompts: project.entries.length,
  activeMinutes: activeMinutes(project.entries),
  summary: '',
  threads: [],
})

export const summaryRequest = (
  project: ProjectEntries,
  window: JournalWindow,
  offsetMinutes: number,
): { system: string; prompt: string } | null => {
  const prompts = promptsForModel(project.entries, PROMPT_LIMIT[window.kind], offsetMinutes)
  if (prompts === '') {
    return null
  }

  return {
    system: SYSTEM,
    prompt: `Project: ${project.name} (${project.path})\nWindow: ${window.label}\nAt most ${THREAD_LIMIT[window.kind]} threads, the largest first.\n\nPrompts, oldest first:\n${prompts}`,
  }
}

export const threadLimit = (window: JournalWindow): number => THREAD_LIMIT[window.kind]
