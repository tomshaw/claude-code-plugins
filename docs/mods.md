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

### 📓 work-journal

Reviews your work for a day, a week or a month, summarized from the prompts you typed into Claude Code.

- `/journal` opens today in a pane beside the chat. `/journal week`, `/journal month`, `yesterday`, `last week`, `last month`, a date (`2026-10-05`) or a month (`2026-09`) pick another window. Weeks run Monday to Sunday
- Add `web` (`/journal week web`) to also save it as a webpage and open it in your browser. It's one self-contained HTML file in `~/.claude/work-journal/`, with light and dark mode and print styles. Press `o` in the pane for the same
- In the pane: `d`, `w` and `m` switch to a day, week or month, `p` and `n` step back and forward, `r` rebuilds, `o` opens the webpage, and Esc closes it. The arrows scroll
- Each review shows the prompt count, projects and active time, a chart of prompts per hour or per day, and a card per project. Each card lists its threads (distinct pieces of work, named in plain language), each with its goal, the decisions made (`✓`) and what's still open (`○`)
- It reads `~/.claude/history.jsonl`, the file behind your Up-arrow history, pulling out only the window it needs. Pasted blocks are never read: the history keeps a placeholder like `[Pasted text #1]` in their place
- One model call per project, up to six projects; quieter ones are listed by name. Slash commands, shell commands and short replies ("yes", "go ahead") count toward activity but aren't sent to the model
- Active time adds up the gaps between prompts, counting any gap over 30 minutes as 5 minutes
- Finished days, weeks and months are kept and load instantly. The current one is rebuilt when it's more than 15 minutes old, or when you press `r`
- Settings (`/plugin` → work-journal → configure): **Projects to leave out**, comma-separated parts of project paths, whose prompts are never read; and **Model**, `opus` (default), `sonnet` or `haiku`
- The history file is Claude Code's own and undocumented, so a future version could change its format

### ⚒️ laravel-tooling

Checks a Laravel project with Pint, Larastan and Pest, and shows the results in a pane beside the chat.

- After a turn in which Claude edited a `.php` file, it runs `pint --dirty` and then Larastan, using `phpstan.neon` (or `.dist`) with a 2G memory limit
- Pest runs when you ask: `/laravel-tooling tests`, a filter after it (`/laravel-tooling tests Quote`), or `t` in the pane. Turn on **Run tests after edits** to run it after every PHP edit too
- `/laravel-tooling` opens the pane, `run` runs all three, `pint` and `stan` run one each
- The pane shows a row per check (`✓` pass, `✗` fail, `◐` running, `!` could not run) with its time, and each problem by file with its line. The Tests row counts tests as they finish
- In the pane: `r` runs everything, `t` runs the tests, and `f` (when something fails) writes a prompt listing every failure into your input box, for you to edit and send
- The status line reads like `Pint ✓ · Stan 3✗ · Tests 142`, and a toast shows when a passing check starts failing
- It only turns on in a project with `artisan` and `vendor/bin/pint`
- `pint --dirty` formats every uncommitted PHP file, not just the ones Claude edited
- Pest runs without `--parallel`, since per-test results need its TeamCity output, so a full suite takes longer than `composer test`
- Settings (`/plugin` → laravel-tooling → configure): **Run tests after edits** (off by default) and **Default test filter**

### 📝 commit-msg

Writes the commit message for your staged changes from the Claude session that made them. The diff decides what the message covers; the conversation explains why. It never commits anything.

- `/commit-msg` opens a pane and writes one message in your repo's style (the same `feat:`/`fix:` prefixes, tense and issue-number habits as your last 20 commits)
- Work in the session that isn't staged stays out of the message. With no session yet (a new terminal, or after `/clear`), it writes from the diff alone. The pane's header says which
- **Style** (`1` `2` `3`): **Simple** (subject only), **With body** (adds what changed and why) or **With footer** (adds trailers such as `Refs #690`)
- **Edit** (`e`) the lines in place, type a **Guidance** note (`shorter`, `mention #690`) to rewrite it, **Regenerate** (`r`), step through drafts with `p` / `n`, and **Copy** (`c`)
- Start with a style or note: `/commit-msg full closes #690`
- Nothing staged? It uses all uncommitted changes. No room for the pane? The message goes in the transcript and on your clipboard
- Settings (`/plugin` → commit-msg → configure): **Use session context** (on), **Model** for diff-only messages (`sonnet`), **Default style** (`simple`)

## 🛠️ Build your own

Start from [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/). The validate and test commands and the new-mod checklist are in [CONTRIBUTING.md](../CONTRIBUTING.md).

### 🪤 Gotchas

- JSX compiles to `h(...)`, so a variable named `h` breaks every element after it
- Claude Code refuses a command name it already has. Catch the error from `$.command.register`, or the rest of `session.start` never runs
- The test kit has nothing beneath the mod: mock the store with `mock.store(on)` and answer `model.complete` with `{ value: ... }`
- A `model.complete` hook result and other `$` call results are wrapped as `{ value }` or `{ deny }`
- A helper that takes `$` must be a top-level function in the hooks module itself, not in an imported file or a closure inside `register`
- Work that must outlive a command or a button press goes through `$.clock.after(0, ...)`, or it's cut off when that dispatch ends
