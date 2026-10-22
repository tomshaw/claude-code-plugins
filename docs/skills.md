# 🧠 The skills in detail

- 🏠 Overview: [README](../README.md)

Skills are instructions Claude loads when your request matches them. Ask in plain words; you don't need to call them by name.

## 🧩 Notes per skill

### 📊 commit-summary

Summarizes the git commits in a window of time: who did what, grouped by theme, with line counts and highlights.

- **The window** defaults to today. Ask for `yesterday`, a weekday, `this week`, `last week`, `this month`, `last month`, `past 7 days`, a date or a range (`2026-09-01..2026-09-15`, "since Sept 1"). Weeks start on Monday. The summary names the window it used
- **The author** defaults to everyone. Name someone ("what has Jane done this week") or say "my"/"me" for the repo's git user. When a name matches no commits, it looks for the closest author in the window and says which one it picked
- **Detail scales with the window.** A day lists each commit under its theme. A week gives a line per theme plus commits per day. A month gives the top themes across everyone, plus commits per week
- **Every summary has** a headline, totals (commits, merges, contributors, `+added / −removed` across files), a per-author table, and highlights: the largest commit, most-changed files, reverts and security fixes, merged branches
- Themes come from what the commit messages describe, not from the `feat:`/`fix:` prefix alone
- Reads all local branches unless you name one. Merge commits are counted but left out of themes and line counts
- An empty window says so and shows the last day with commits. It never invents activity

Try:

```
summarize today's commits
what did I work on this week?
monthly recap for Jane
commits from 2026-09-01 to 2026-09-15 on main
```

### 🗺️ module-map

Maps the structure of code: which modules exist, what each owns, what other modules use from it, and how dependencies flow. It shows the shape of a change that a line-by-line diff hides.

- **Three modes**, picked from how you ask: **existing** maps a folder or feature as it is now; **changes** maps what a branch, commit range or uncommitted work touched, with a before and after; **proposed** maps a plan that isn't built yet against the current code
- **Changes mode defaults** to your branch plus uncommitted and untracked files, compared with where it split from the default branch (`main` or `master`, detected). On the default branch with nothing changed, it maps the last commit and says so
- **Works in any language or framework.** It reads how the codebase connects its parts before mapping, so links that aren't direct references still count, and it labels how each one is made
- **Stays small**: the target plus its direct neighbors, at most about 15 modules. Bigger maps are grouped by folder, and maps over about 6 modules add a Mermaid dependency graph
- **Every map has** a table (module, responsibility, public surface, depends on), then structural changes (`+` added, `−` removed, `~` changed), flags, and a 1–3 sentence summary
- **Flags** circular dependencies, bypassed boundaries, use of another module's private parts, an outside system spreading to more modules, modules doing two jobs, and a sharply widened public surface. It only flags what it can point to, judged by the codebase's own conventions
- When a change only edits code inside existing modules, it says "No structural change" in one line and stops. A vague plan gets a list of open questions, not guesses

Try:

```
map the billing module
what did this branch change structurally?
how did the last 3 commits change the dependencies?
map how adding a payments provider would fit in
```

### 💬 laymans-terms

Explains something technical in simple, everyday words, so someone outside the field understands it on the first read.

- **The topic** is whatever you name. Name nothing and it re-explains Claude's last reply
- **The reader** defaults to a smart adult with no background in the field. Name one ("for a client", "for my boss", "for a new hire") and it picks the details that matter to them
- **Every answer follows one shape**: the point, why it matters, an everyday comparison, a real example, and what it means for the reader. Steps that add nothing are skipped
- Technical words that must stay are explained once and then used consistently. File names, version numbers and code are left out unless you ask
- It simplifies but never says something false, and keeps any warning that would change a decision

Try:

```
/laymans-terms
explain passkeys in layman's terms
explain this bug in plain English for a client
I'm not technical, what does this change do?
```

### 🧭 five-ws

Asks who, what, where, when, why and how about any task, problem or plan, the way a good reporter would. Each question is its own skill with a fixed method and output, and each fills a gap Claude leaves when it just answers. Use one alone, or `/five-ws` to run all six and check the answers against each other. It works on code in a repository, and just as well on a project, a process, an event or a decision you describe.

| Skill | Gives you | Catches what would otherwise be missed |
| --- | --- | --- |
| `/five-ws:who` | A people map: who does it, who signs off, who is affected (and how), who must be told, plus a check of who can vs who should | A change that quietly affects someone, and something hidden from a group that they can still reach |
| `/five-ws:what` | A problem statement: what was noticed vs the real problem vs the fix someone suggested, what is in and out, and "done when" checks | Building the suggested fix before the real problem is pinned down, or building something that already exists |
| `/five-ws:where` | Every place a change touches, swept kind by kind, plus "twins" that repeat the same rule or wording | Fixing one spot and missing the document, email, price list, report or test that must change with it |
| `/five-ws:when` | A timeline: when something started, broke, changed or was fixed; the order planned work must follow; what sets something off and what happens next | Loose lists where the order is the answer, and how long a problem went unnoticed |
| `/five-ws:why` | A chain of "why" with evidence at every step down to the root cause, or the goal behind a request or decision | Stopping at the first plausible cause, and made-up reasons for why something exists |
| `/five-ws:how` | A step plan where every step has a method and a check that proves it worked, riskiest step first | Plans that are only checked at the end, so an early mistake shows up late |
| `/five-ws` | A one-screen brief of all six, then the gaps and contradictions between them | Answers that disagree, like "managers only" in the request but everyone able to do it in practice |

- **Two directions.** Point any of them at something that exists (a feature, a problem, an incident) or at work not yet started. Before work, `/five-ws` stops with the questions to ask instead of building on unknowns
- **Every claim has evidence** (a file, commit, document, message or something you said) or is labeled inferred. Missing answers say "Unknown" and who would know, never a guess
- **Add "for a client"** (or any reader) to drop technical references and write in plain words

Try:

```
/five-ws add an export button to the reports page
/five-ws:why did our invoice totals change last week
/five-ws:where rename the "Basic" plan to "Starter"
/five-ws:who moving the team offsite to Thursdays, for my manager
/five-ws:how move our files from Dropbox to Google Drive
/five-ws:when did the login emails stop arriving
```

### 🔬 paper-trail

A lab notebook for work you'll need to check, however long it takes. Afterwards you can check what Claude decided and why without redoing the work.

- **Use it when the reasoning matters**, not when the task is long: a long unattended run, a tricky bug fix whose cause had to be proven, a change to auth, data, money or deletions, a choice between designs, or anything going to review. Skip it for simple work you watch step by step
- **One row per real decision**: a choice between options, finished and tested work, a change of direction, an undo, a blocker, a fixed test, or a correction. Routine steps are left out, so the log stays short enough to read
- **Every row has proof you can open**: a commit, file lines pinned to a commit, a captured command output, or a PR. Prose like "I checked it" is refused
- **Test runs are captured, not described.** Claude runs tests through the log tool, which saves the output with its exit code. A row that says "pass" while citing a failed run is refused
- **Nothing is edited.** A wrong row gets a new row that replaces it, and every row is fingerprinted, so changes made by hand show up in the check
- **Handoffs are marked.** A new chat or session starts with a row naming the earlier rows it didn't write, and treats them as claims to re-check
- **Checked before you see it**: the tool resolves every piece of evidence and lists commits no row explains. Claude compares the log with what it actually did. A model from another family (Codex, Gemini, etc., if installed and you agree) reviews it, or a fresh Claude subagent if not, labeled as the same family. Every report ends with an **Attention** block naming the reviewer and its concerns, or "No flags"
- **Stays out of git** (through `.git/info/exclude`, so your `.gitignore` isn't touched) until you promote it to `docs/work-log/` for a PR

Try:

```
/paper-trail start migrate the jobs table to the new queue
I'll be away for a few hours, leave a paper trail
leave a paper trail while you fix the session-expiry bug
/paper-trail check
/paper-trail promote
```
