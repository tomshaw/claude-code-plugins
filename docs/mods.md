# 📖 The mods in detail

- 🏠 Overview: [README](../README.md)

## 🧩 Mod guides

<a id="proofread"></a>

### ✍️ proofread: type fast, never get misread

You type fast, and your prompts show it: "teh", a missing word, a sentence that reads two ways. Claude has to guess what you meant, and sometimes it guesses wrong. **proofread fixes your prompt before Claude ever reads it.**

- **Typos and grammar fixed, nothing reworded.** Code, file paths, commands, URLs and jargon are left exactly as you typed them.
- **You see every change.** Fixed words are highlighted in green, and a toast lists what changed.
- **Your prompts stand out.** Each one is drawn in a box, so you can find it fast when you scroll back.
- **It stays out of your way.** Slash commands, shell commands and very short prompts are skipped. If the fix fails or is slow, your original goes through.

**The payoff:** say what you mean on the first try, at your normal typing speed. It costs about a second and one small Haiku call per prompt.

**How to use**

```sh
claude plugin install proofread@tomshaw
```

It's on as soon as it's installed. Just type.

```
/proofread          turn it on or off
/proofread on|off   set it
/proofread status   check it
```

#### 🔧 Details

- Each prompt you type goes to Haiku first, told to fix typos and clear grammar mistakes only, in the prompt's own language. Code, file paths, identifiers, commands, URLs and jargon are left alone, and nothing is reworded
- When it changes something, Claude gets the corrected prompt and a toast lists the words it fixed
- Your prompts are drawn in a rounded box with a colored `❯`. Fixed words are green, bold and underlined, with a dim `✓ proofread fixed N words` line under the prompt
- Skipped: slash commands (`/…`), shell commands (`!…`), prompts under 3 words or over 4,000 characters, and messages that aren't yours (task notifications, peers)
- Falls back to your original prompt when Haiku fails, takes over 8 seconds, or replies with something that isn't a correction (its length changes by more than 20%)
- Adds about 1 to 2 seconds and one small Haiku call per prompt
- `/proofread` turns it on or off, `/proofread on|off` sets it, `/proofread status` says which. The choice is kept across sessions, and the status line shows `proofread: off` while it's off. The box stays either way
- Your Up-arrow history keeps what you typed: Claude Code saves it before mods run
- Colors are the theme's `suggestion` (box) and `success` (fixed words). Change `ACCENT` and `FIX` at the top of `hooks/register.tsx`

<a id="work-journal"></a>

### 📓 work-journal: know what you did, without writing it down

Friday afternoon, standup or performance review: "what did I actually do?" Your work is spread across a dozen sessions and projects, and you didn't write any of it down. **work-journal writes it up for you from the prompts you typed.**

- **A card for each project**, with the threads of work in plain language, the decisions made (`✓`) and what's still open (`○`).
- **Any window:** today, yesterday, this or last week, this or last month, or a specific date.
- **Charts and stats:** prompts per hour or day, active time and projects touched.
- **A pane or a webpage.** Read it beside the chat, or open a self-contained page to share or print.
- **Private where it matters.** Leave whole projects out, and pasted text is never read.

**The payoff:** standups in seconds, weekly reviews without guilt, and a record of decisions you'd otherwise lose.

**How to use**

```sh
claude plugin install work-journal@tomshaw
```

```
/journal                    today, in a pane
/journal week               this week (also: yesterday, last week, month, last month)
/journal 2026-10-05         a specific day (or a month: 2026-09)
/journal week web           also open it as a webpage
```

In the pane: `d` `w` `m` switch day, week or month, `p` / `n` step back and forward, `r` rebuilds, `o` opens the webpage, and `Esc` closes it. Settings (`/plugin` → work-journal → configure): projects to leave out, and the model.

#### 🔧 Details

- `/journal` opens today in a pane beside the chat. `/journal week`, `/journal month`, `yesterday`, `last week`, `last month`, a date (`2026-10-05`) or a month (`2026-09`) pick another window. Weeks run Monday to Sunday
- Add `web` (`/journal week web`) to also save it as a webpage and open it in your browser. It's one self-contained HTML file in `~/.claude/work-journal/` (or `$CLAUDE_CONFIG_DIR/work-journal/`), with light and dark mode and print styles. Press `o` in the pane for the same
- In the pane: `d`, `w` and `m` switch to a day, week or month, `p` and `n` step back and forward, `r` rebuilds, `o` opens the webpage, and Esc closes it. The arrows scroll
- Each review shows the prompt count, projects and active time, a chart of prompts per hour or per day, and a card per project. Each card lists its threads (distinct pieces of work, named in plain language), each with its goal, the decisions made (`✓`) and what's still open (`○`)
- It reads `~/.claude/history.jsonl` (or `$CLAUDE_CONFIG_DIR/history.jsonl`), the file behind your Up-arrow history, pulling out only the window it needs. Pasted blocks are never read: the history keeps a placeholder like `[Pasted text #1]` in their place
- One model call per project, up to six projects; quieter ones are listed by name. Slash commands, shell commands and short replies ("yes", "go ahead") count toward activity but aren't sent to the model
- Active time adds up the gaps between prompts, counting any gap over 30 minutes as 5 minutes
- Finished days, weeks and months are kept and load instantly. The current one is rebuilt when it's more than 15 minutes old, or when you press `r`
- Settings (`/plugin` → work-journal → configure): **Projects to leave out**, comma-separated parts of project paths, whose prompts are never read; and **Model**, `opus` (default), `sonnet` or `haiku`
- The history file is Claude Code's own and undocumented, so a future version could change its format

<a id="laravel-tooling"></a>

### ⚒️ laravel-tooling: Claude's PHP, checked before you have to

Claude edits your Laravel code, and you find the style drift, the type error and the broken test later, on CI or in review. **laravel-tooling checks every PHP edit as it happens and shows you the results live.**

- **Automatic after every PHP edit:** `pint --dirty` formats, then Larastan finds type errors.
- **Tests on demand:** Pest, or PHPUnit when Pest isn't installed, filtered or full, and after every edit if you turn that on.
- **A live pane** with `✓` / `✗` per check, each problem listed by file and line, and tests counted as they finish.
- **One key to fix it:** `f` writes a prompt listing every failure into your input box, ready to send to Claude.
- **Always visible:** the status line reads `Pint ✓ · Stan 3✗ · Tests 142`, and a toast warns when a passing check breaks.

**The payoff:** Claude's PHP arrives formatted, type-checked and tested, so you catch problems in seconds instead of on CI.

**How to use**

```sh
claude plugin install laravel-tooling@tomshaw
```

It turns on in any project with an `artisan` file, and uses whichever of Pint, Larastan, Pest and PHPUnit are in `vendor/bin`.

```
/laravel-tooling              open the pane
/laravel-tooling run          run all checks
/laravel-tooling pint|stan    run one
/laravel-tooling tests Quote  run tests, with an optional filter
```

In the pane: `r` runs everything, `t` runs the tests, and `f` writes a fix prompt. Settings: **Run tests after edits** and **Default test filter**.

#### 🔧 Details

- After a turn in which Claude edited a `.php` file, it runs `pint --dirty` and then Larastan, using `phpstan.neon`, `phpstan.neon.dist` or `phpstan.dist.neon` with a 2G memory limit
- Tests run with Pest, or PHPUnit when Pest isn't installed, when you ask: `/laravel-tooling tests`, a filter after it (`/laravel-tooling tests Quote`), or `t` in the pane. Turn on **Run tests after edits** to run it after every PHP edit too
- `/laravel-tooling` opens the pane, `run` runs all three, `pint` and `stan` run one each
- The pane shows a row per check (`✓` pass, `✗` fail, `◐` running, `!` could not run) with its time, and each problem by file with its line. The Tests row counts tests as they finish
- In the pane: `r` runs everything, `t` runs the tests, and `f` (when something fails) writes a prompt listing every failure into your input box, for you to edit and send
- The status line reads like `Pint ✓ · Stan 3✗ · Tests 142`, and a toast shows when a passing check starts failing
- It only turns on in a project with an `artisan` file, and runs only the tools found in `vendor/bin`. A missing one shows as `not installed`. Failures are located in any folder, with `vendor/` stack frames skipped
- `pint --dirty` formats every uncommitted PHP file, not just the ones Claude edited
- Tests run without `--parallel`, since per-test results need TeamCity output, so a full suite takes longer than `composer test`
- Settings (`/plugin` → laravel-tooling → configure): **Run tests after edits** (off by default) and **Default test filter**

<a id="commit-msg"></a>

### 📝 commit-msg: commit messages that remember why

"fix stuff." "update." "wip." Six months later, nobody knows why the change was made, and that includes you. The diff shows what changed, but the reason was in your conversation with Claude. **commit-msg writes the message from that conversation.**

- **It explains why.** The diff decides what the message covers; the session explains why it was done.
- **It matches your repo:** the same `feat:` / `fix:` prefixes, tense and issue-number habits as your last 20 commits.
- **Three styles:** subject only, with a body, or with footers such as `Refs #42`.
- **Your call, always.** Edit it in place, steer it with a note ("shorter", "mention #42"), regenerate, step through drafts, then copy. It never commits for you.

**The payoff:** a git history that answers "why?" for the rest of the project's life, at the cost of one keystroke.

**How to use**

```sh
claude plugin install commit-msg@tomshaw
```

Stage your changes, then:

```
/commit-msg                   write a message in your repo's style
/commit-msg full closes #42   start with a style and a note
```

In the pane: `1` `2` `3` pick the style, `e` edits, `r` regenerates, `p` / `n` step through drafts, and `c` copies. With nothing staged it uses all uncommitted changes. Settings: **Use session context**, **Model** and **Default style**.

#### 🔧 Details

- `/commit-msg` opens a pane and writes one message in your repo's style (the same `feat:`/`fix:` prefixes, tense and issue-number habits as your last 20 commits)
- Work in the session that isn't staged stays out of the message. With no session yet (a new terminal, or after `/clear`), it writes from the diff alone. The pane's header says which
- **Style** (`1` `2` `3`): **Simple** (subject only), **With body** (adds what changed and why) or **With footer** (adds trailers such as `Refs #42`)
- **Edit** (`e`) the lines in place, type a **Guidance** note (`shorter`, `mention #42`) to rewrite it, **Regenerate** (`r`), step through drafts with `p` / `n`, and **Copy** (`c`)
- Start with a style or note: `/commit-msg full closes #42`
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
