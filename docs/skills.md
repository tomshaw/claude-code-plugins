# 🧠 The skills in detail

- 🏠 Overview: [README](../README.md)

Skills are instructions Claude loads when your request matches them. Ask in plain words; you don't need to call them by name.

## 🧩 Skill guides

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

#### 🔧 Details

- **The window** defaults to today. Ask for `yesterday`, a weekday, `this week`, `last week`, `this month`, `last month`, `past 7 days`, a date or a range (`2026-09-01..2026-09-15`, "since Sept 1"). Weeks start on Monday. The summary names the window it used
- **The author** defaults to everyone. Name someone ("what has Jane done this week") or say "my"/"me" for the repo's git user. When a name matches no commits, it looks for the closest author in the window and says which one it picked
- **Detail scales with the window.** A day lists each commit under its theme. A week gives a line per theme plus commits per day. A month gives the top themes across everyone, plus commits per week
- **Every summary has** a headline, totals (commits, merges, contributors, `+added / −removed` across files), a per-author table, and highlights: the largest commit, most-changed files, reverts and security fixes, merged branches
- Themes come from what the commit messages describe, not from the `feat:`/`fix:` prefix alone
- Reads all local branches unless you name one. Merge commits are counted but left out of themes and line counts
- An empty window says so and shows the last day with commits. It never invents activity

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

#### 🔧 Details

- **Three modes**, picked from how you ask: **existing** maps a folder or feature as it is now; **changes** maps what a branch, commit range or uncommitted work touched, with a before and after; **proposed** maps a plan that isn't built yet against the current code
- **Changes mode defaults** to your branch plus uncommitted and untracked files, compared with where it split from the default branch (`main` or `master`, detected). On the default branch with nothing changed, it maps the last commit and says so
- **Works in any language or framework.** It reads how the codebase connects its parts before mapping, so links that aren't direct references still count, and it labels how each one is made
- **Stays small**: the target plus its direct neighbors, at most about 15 modules. Bigger maps are grouped by folder, and maps over about 6 modules add a Mermaid dependency graph
- **Every map has** a table (module, responsibility, public surface, depends on), then structural changes (`+` added, `−` removed, `~` changed), flags, and a 1–3 sentence summary
- **Flags** circular dependencies, bypassed boundaries, use of another module's private parts, an outside system spreading to more modules, modules doing two jobs, and a sharply widened public surface. It only flags what it can point to, judged by the codebase's own conventions
- When a change only edits code inside existing modules, it says "No structural change" in one line and stops. A vague plan gets a list of open questions, not guesses

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

#### 🔧 Details

- **The topic** is whatever you name. Name nothing and it re-explains Claude's last reply
- **The reader** defaults to a smart adult with no background in the field. Name one ("for a client", "for my boss", "for a new hire") and it picks the details that matter to them
- **Every answer follows one shape**: the point, why it matters, an everyday comparison, a real example, and what it means for the reader. Steps that add nothing are skipped
- Technical words that must stay are explained once and then used consistently. File names, version numbers and code are left out unless you ask
- It simplifies but never says something false, and keeps any warning that would change a decision

<a id="five-ws"></a>

### 🧭 five-ws: ask what a good reporter would, before you start

Most failed work wasn't built badly. It was built for the wrong problem, missed something it touched, or surprised someone nobody thought to tell. **five-ws asks who, what, where, when, why and how before you start, then finds where the answers don't add up.**

- **Six questions, six skills.** Each has its own method and fills a gap Claude leaves when it just answers. The table below shows what each one catches.
- **All six together** (`/five-ws`): a one-screen brief, then the gaps and contradictions between the answers.
- **Evidence, not guesses.** Every claim points at a file, commit, document or message, or is labeled inferred. Missing answers say "Unknown."

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

#### 🔧 Details

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

#### 🔧 Details

- **One row per real decision**: a choice between options, finished and tested work, a change of direction, an undo, a blocker, a fixed test, or a correction. Routine steps are left out, so the log stays short enough to read
- **Every row has proof you can open**: a commit, file lines pinned to a commit, a captured command output, or a PR. Prose like "I checked it" is refused
- **Test runs are captured, not described.** Claude runs tests through the log tool, which saves the output with its exit code. A row that says "pass" while citing a failed run is refused
- **Nothing is edited.** A wrong row gets a new row that replaces it, and every row is fingerprinted, so changes made by hand show up in the check
- **Handoffs are marked.** A new chat or session starts with a row naming the earlier rows it didn't write, and treats them as claims to re-check
- **Checked before you see it**: the tool resolves every piece of evidence and lists commits no row explains. Claude compares the log with what it actually did. A model from another family (Codex, Gemini, etc., if installed and you agree) reviews it, or a fresh Claude subagent if not, labeled as the same family. Every report ends with an **Attention** block naming the reviewer and its concerns, or "No flags"
- **Stays out of git** (through `.git/info/exclude`, so your `.gitignore` isn't touched) until you promote it to `docs/work-log/` for a PR


<a id="trust-me-bro"></a>

### 🤙 trust-me-bro: the straight answer, right now

"Did it work?" usually gets a confident paragraph you can't check. **trust-me-bro gives you the short version in plain words, with every claim marked by how sure Claude actually is.**

- **Four parts, one screen:** what I did, what it means for you, how sure I am, and your call.
- **Every claim marked:** ✅ checked (something ran or was read after the last edit), 🤞 pretty sure (reasoned but not run), or ⚠️ didn't check.
- **Downgrades, never upgrades.** "Tests pass" with no test run becomes ⚠️. A failure goes in the first line, not the fine print.
- **Instant.** No log, no files, no setup. It works only from what happened in this session.

**Use it at the end of a task when you want the bottom line,** not a record. When the stakes are higher (login, data, money, deletions, or work you didn't watch), it tells you to run [paper-trail](#paper-trail) instead.

**The payoff:** you know in ten seconds what changed and which parts you can lean on.

**How to use**

```sh
claude plugin install trust-me-bro@tomshaw
```

```
/trust-me-bro                    debrief the last task
did it work? give me the short version
/trust-me-bro the login fix, for my boss
```

#### 🔧 Details

- **What it covers** defaults to the most recent task, from your last request to now. Name something ("the login fix", "today's changes") to narrow it
- **The reader** defaults to a smart adult who didn't watch the work. Name one ("for my boss", "for a client") and it writes for them
- **✅ needs proof from this session**: a test, build or command that ran after the last edit, or a file it read. A check that ran before a later edit counts as 🤞 at best, and a partial run is named as partial ("the login tests pass")
- **Assumptions are flagged.** Anything decided without asking you is ⚠️ and appears under "Your call"
- **It won't run new checks by itself.** When there are ⚠️ items it could check, it offers once
- File names, code and commit hashes are left out unless you ask
- **trust-me-bro vs paper-trail:** trust-me-bro is the straight answer you get now; paper-trail is the receipt you keep, with evidence, a log and a second reviewer
