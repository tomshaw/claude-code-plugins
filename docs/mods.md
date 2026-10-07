# 📖 The mods in detail

- 🏠 Overview: [README](../README.md)

## 🧩 Notes per mod

### ✍️ proofread

Fixes the spelling and grammar of your prompt before Claude reads it, and makes your prompts easy to spot in the transcript.

- Each prompt you type goes to Haiku first, told to fix typos and clear grammar mistakes only. Code, file paths, identifiers, commands, URLs and jargon are left alone, and nothing is reworded
- When it changes something, Claude gets the corrected prompt and a toast lists the words it fixed
- Your prompts are drawn in a rounded box with a colored `❯`. Fixed words are green, bold and underlined, with a dim `✓ proofread fixed N words` line under the prompt
- Skipped: slash commands (`/…`), shell commands (`!…`), prompts under 3 words or over 4,000 characters, and messages that aren't yours (task notifications, peers)
- Falls back to your original prompt when Haiku fails, takes over 8 seconds, or replies with something that isn't a correction (its length changes by more than 20%)
- Adds about 1 to 2 seconds and one small Haiku call per prompt
- `/proofread` turns it on or off, `/proofread on|off` sets it, `/proofread status` says which. The choice is kept across sessions, and the status line shows `proofread: off` while it's off. The box stays either way
- Your Up-arrow history keeps what you typed: Claude Code saves it before mods run
- Colors are the theme's `suggestion` (box) and `success` (fixed words). Change `ACCENT` and `FIX` at the top of `hooks/register.tsx`

## 🛠️ Build your own

Start from [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/). The validate and test commands and the new-mod checklist are in [CONTRIBUTING.md](../CONTRIBUTING.md).

### 🪤 Gotchas

- JSX compiles to `h(...)`, so a variable named `h` breaks every element after it
- Claude Code refuses a command name it already has. Catch the error from `$.command.register`, or the rest of `session.start` never runs
- The test kit has nothing beneath the mod: mock the store with `mock.store(on)` and answer `model.complete` with `{ value: ... }`
- A `model.complete` hook result and other `$` call results are wrapped as `{ value }` or `{ deny }`
