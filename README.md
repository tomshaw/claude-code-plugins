<h1 align="center">Claude Code plugins</h1>

<p align="center"><b>Small upgrades for how you work with Claude Code.</b><br>Mods, skills, agents and commands for Claude Code, from one marketplace. Install only the ones you want.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT"></a>
  <a href="https://github.com/tomshaw/claude-code-plugins/actions/workflows/ci.yml"><img src="https://github.com/tomshaw/claude-code-plugins/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
</p>

<p align="center">
  <a href="#-install">Install</a> · <a href="#-mods">Mods</a> · <a href="#-skills">Skills</a> · <a href="docs/mods.md">Docs</a> · <a href="https://claude.dev/blog/getting-started-with-claude-code-mods/">What are mods?</a>
</p>

## 🚀 Install

Add the marketplace once, then install any plugin by name:

```sh
claude plugin marketplace add tomshaw/claude-code-plugins
claude plugin install proofread@tomshaw
claude plugin install work-journal@tomshaw
claude plugin install laravel-tooling@tomshaw
claude plugin install commit-msg@tomshaw
claude plugin install commit-summary@tomshaw
claude plugin install module-map@tomshaw
claude plugin install laymans-terms@tomshaw
claude plugin install five-ws@tomshaw
claude plugin install paper-trail@tomshaw
```

Or from inside Claude Code:

```
/plugin install proofread --marketplace tomshaw/claude-code-plugins
```

Restart Claude Code after installing. To try one without installing:

```sh
git clone https://github.com/tomshaw/claude-code-plugins && cd claude-code-plugins
claude --plugin-dir mods/proofread
```

> **Needs** Claude Code 2.1.293+.

## 🧩 Mods

Plugins built on function hooks: they change what Claude Code shows and does, live.

| | Mod | In one line | Command |
| --- | --- | --- | --- |
| ✍️ | [**proofread**](#proofread) | Your typos never reach Claude | `/proofread` |
| 📓 | [**work-journal**](#work-journal) | Your day, week or month of work, written up for you | `/journal` |
| ⚒️ | [**laravel-tooling**](#laravel-tooling) | Pint, Larastan and your tests, run for you after every PHP edit | `/laravel-tooling` |
| 📝 | [**commit-msg**](#commit-msg) | Commit messages that say why, not just what | `/commit-msg` |

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

## 🧠 Skills

Instructions Claude loads when your request matches them. Ask in plain words.

| | Skill | In one line | Try |
| --- | --- | --- | --- |
| 📊 | [**commit-summary**](#commit-summary) | Your standup, weekly or monthly recap, from git | "what did I do this week?" |
| 🗺️ | [**module-map**](#module-map) | The shape of your code and of every change to it | "what did this branch change structurally?" |
| 💬 | [**laymans-terms**](#laymans-terms) | Tech explained so anyone gets it on the first read | "explain this in layman's terms for a client" |
| 🧭 | [**five-ws**](#five-ws) | Who, what, where, when, why and how, before you start | "brief me on this before we start" |
| 🔬 | [**paper-trail**](#paper-trail) | Proof for every decision Claude makes | "leave a paper trail" |

<a id="commit-summary"></a>

### 📊 commit-summary: your standup, written by your commits

"What did I do yesterday?" "What did the team ship this month?" The answer is in git, buried in hundreds of one-line messages. **commit-summary turns them into a recap you can read in a minute.**

- **Grouped by theme**, from what the commits actually describe, not just their `feat:` / `fix:` prefix.
- **Any window or author:** today, yesterday, a weekday, this or last week or month, or a date range; everyone, you, or one teammate.
- **The numbers:** commits, merges, contributors, lines added and removed, and a table per author.
- **Highlights:** the largest commit, most-changed files, reverts, security fixes and merged branches.
- **Honest when it's quiet.** An empty window says so and points to the last day with commits. It never invents activity.

**The payoff:** standups, weekly updates and monthly reports in seconds, straight from the record.

**How to use**

```sh
claude plugin install commit-summary@tomshaw
```

Ask in plain words:

```
summarize today's commits
what did I work on this week?
monthly recap for Jane
commits from 2026-09-01 to 2026-09-15 on main
```

<a id="module-map"></a>

### 🗺️ module-map: see the shape of a change, not just its lines

A 40-file diff tells you which lines changed. It doesn't tell you that a new dependency now runs the wrong way, or that two modules just became tangled. **module-map shows the structure that line-by-line diffs hide.**

- **Three modes:** map code as it is, map what a branch, PR or uncommitted work changed (before and after), or map a planned design against today's code.
- **A clear table:** each module, what it owns, what it exposes and what it depends on, plus a dependency graph for bigger maps.
- **Problems flagged:** circular dependencies, bypassed boundaries, reaching into another module's private parts, and modules doing two jobs.
- **Any language or framework.** It learns how your codebase connects its parts before it maps them.
- **Quiet when nothing changed structurally.** You get one line saying so, not a padded report.

**The payoff:** catch architecture problems in review, before they're merged and expensive to undo.

**How to use**

```sh
claude plugin install module-map@tomshaw
```

```
map the billing module
what did this branch change structurally?
how did the last 3 commits change the dependencies?
map how adding a payments provider would fit in
```

<a id="laymans-terms"></a>

### 💬 laymans-terms: explain it so anyone gets it

Your client, your boss or your new hire asks what's going on, and the honest answer is full of jargon. **laymans-terms explains it in everyday words, so they understand it on the first read.**

- **Always the same clear shape:** the point, why it matters, an everyday comparison, a real example, and what it means for the reader.
- **Written for your reader.** Say "for a client" or "for my boss" and it picks the details that matter to them.
- **Simple, never wrong.** It simplifies without saying anything false, and keeps any warning that would change a decision.
- **No jargon left behind.** A technical word that must stay is explained once and then used consistently.

**The payoff:** fewer confused replies and follow-up meetings, and more people who get it.

**How to use**

```sh
claude plugin install laymans-terms@tomshaw
```

```
/laymans-terms                               re-explain Claude's last reply
explain passkeys in layman's terms
explain this bug in plain English for a client
I'm not technical, what does this change do?
```

<a id="five-ws"></a>

### 🧭 five-ws: ask what a good reporter would, before you start

Most failed work wasn't built badly. It was built for the wrong problem, missed something it touched, or surprised someone nobody thought to tell. **five-ws asks who, what, where, when, why and how before you start, then finds where the answers don't add up.**

- **Who:** who's affected, who approves, who must be told, and whether the people who *can* do something match the people who *should*.
- **What:** the real problem, separated from the symptom and the suggested fix, with "done when" checks.
- **Where:** every place a change touches, including the "twins" that repeat the same rule or wording.
- **When:** a timeline of what broke and when, or the order planned work must follow.
- **Why:** a chain of "why" with evidence at every step, down to a root cause, or the real goal behind a request.
- **How:** a step plan where every step has a check that proves it worked, riskiest step first.
- **All six together** (`/five-ws`): a one-screen brief, then the gaps and contradictions between the answers.

**The payoff:** the questions you'd have wished you asked come up before the work starts, not after it ships.

**How to use**

```sh
claude plugin install five-ws@tomshaw
```

```
/five-ws add an export button to the reports page
/five-ws:why did our invoice totals change last week
/five-ws:where rename the "Basic" plan to "Starter"
/five-ws:who moving the team offsite to Thursdays, for my manager
/five-ws:how move our files from Dropbox to Google Drive
/five-ws:when did the login emails stop arriving
```

Works on code, projects, processes and decisions. Add `for <reader>` to get it in plain words.

<a id="paper-trail"></a>

### 🔬 paper-trail: stop taking Claude's word for it

Every time Claude says "fixed it" or "all tests pass," you have two options: trust it, or redo the work to check. **paper-trail gives you a third: check it in two minutes.**

- **Proof on every decision:** a commit, the exact lines, or the saved test run. "Trust me" is refused.
- **A built-in check that catches false claims.** A "pass" on a failed run, evidence that points nowhere and commits nobody explained are all flagged before you see them.
- **A second opinion included.** Another model reviews the work, and you get a plain **Attention** list, or "No flags."
- **The full story, including the misses:** the approaches it dropped, the guesses it made and the mistakes it corrected.

**Use it whenever the reasoning matters, however long the task takes:** the overnight refactor you didn't watch, the ten-minute bug fix where the cause had to be proven, the auth, data or payments change you'll answer for, the design choice where the options that lost would otherwise go unrecorded, or the PR your reviewer will question.

**The payoff:** review in minutes instead of redoing hours. Hand work to the next session or teammate without losing context, and back up every decision when someone asks "why?"

**How to use**

```sh
claude plugin install paper-trail@tomshaw
```

Needs Python 3. Start it with the task, then let Claude work:

```
/paper-trail start migrate the jobs table to the new queue
leave a paper trail while you fix the session-expiry bug
/paper-trail check        verify the log and show it
/paper-trail promote      copy the log into docs/work-log/ for a PR
```

The log lives in `.paper-trail/` and stays out of git until you promote it.

## 📚 More

- 📖 [**docs/mods.md**](docs/mods.md): how the mods behave, setup notes and build your own
- 🧠 [**docs/skills.md**](docs/skills.md): what each skill does and how to ask for it
- 🤝 [**CONTRIBUTING.md**](CONTRIBUTING.md): where each kind of plugin goes, and how to add one
