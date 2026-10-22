---
name: when
description: "Build a timeline. For something that happened: when it started or changed, last known good, first known bad, noticed and fixed, from history, records and logs. For planned work: deadlines, what must happen first, and the order of steps. For something that runs: what triggers it and in what order things happen. Works for software, projects, processes or events. Use for /five-ws:when, 'when did this break', 'when did this change', 'what order', 'what has to happen first', 'when does this run', or deadlines."
argument-hint: "[problem|change|plan|process] [for <reader>]"
---

# When

Produce a **timeline**. Left alone, an agent describes events and tasks as a loose list. It rarely rebuilds the actual sequence from the record, or works out which step must come before another. Order and timing are often the whole answer: what broke first, what has to happen before what, which step fires before which.

## Pick the mode

- **History:** something already happened (a problem, a regression, a changed number, a decision). Reconstruct the past.
- **Plan:** work that has not happened yet. Sequence the future.
- **Runtime:** how something that exists runs over time (a feature, a workflow, a process). Map its triggers and order.

If the subject fits more than one, do each that applies, history first.

**Evidence** comes from whatever exists: in a code repository, git history, tags, logs and linked issues; otherwise dated documents, emails, messages, calendars, invoices and the dates the user gives.

## History procedure

1. Find what is involved, then its history. In a code repository: `git log --follow --format='%h %ad %an %s' --date=short -- <paths>`, covering the places that trigger it (schedules, routes, listeners) as well as its own files. Elsewhere: document versions, change logs, dated messages.
2. Find when the specific behavior changed. In a code repository: `git log -S'<literal>'` or `git log -G'<pattern>'` on the key value, formula or condition. Elsewhere: compare versions of the document, price list or policy.
3. Gather outside dates: issues and their comments, releases (in git, the first tag containing a commit: `git tag --contains <hash> --sort=creatordate | head -1`), log entries, meetings, the date the user reports.
4. Place the markers, each with evidence.
   - **For a problem:** Last known good, Cause introduced, First known bad, Noticed, Fixed (if it has been).
   - **For an intended change** (a feature, an improvement, a policy): Introduced, each change in behavior since, Released or took effect, or `Not released yet`.
5. If the cause is uncertain and the problem can be reproduced, propose a way to narrow it down. In git: `git bisect` with a concrete good and bad commit and a check command.
6. **For a problem**, state the gap between introduced and noticed. A long gap means something should have caught it sooner, so say what. For an intended change, write `Gap: not applicable`.

## Plan procedure

1. Collect fixed dates: deadlines, releases, meetings, and dependencies on other people.
2. List the steps, then for each step, what it **needs first**. That gives the order.
3. Mark what can run in parallel and which chain is the longest (the critical path).
4. Put the riskiest or least certain step as early as its dependencies allow.

## Runtime procedure

1. Find what starts it: a person's action, a save, a status change, an event, a schedule, a queue, an incoming request.
2. Follow what happens next and in what order: the handlers, jobs or people that act on it in turn.
3. Note anything that happens later or asynchronously, and anything whose order is not guaranteed.
4. Check near misses: things that look like they trigger it (a deploy step, a button, a documented procedure) but actually start something else. Say what they skip.

## Output

Give each mode its own heading and table.

```
Timeline: <subject>

History
| When | What | Evidence |
|---|---|---|
| 2026-09-02 | Last known good | commit a1b2c3d |
| 2026-09-04 | Cause introduced: <what changed> | commit e4f5a6b |
| ... |
Gap introduced → noticed: <duration, what should have caught it>  |  not applicable

Runtime
| Trigger or step | What | Evidence |
|---|---|---|
| Every 30 min | <what starts it> | <schedule location> |
| Step 1 | <what happens first> | <location> |
| ... |

Order notes: <critical path for a plan; unguaranteed order and near misses for runtime>
```

## Rules

- **Evidence for every row.** A commit, a log line, an issue, a document, a message, or a date the user gave. Otherwise `(inferred)`, or `Unknown, ask: <who would know>`.
- **History and plan dates are absolute.** Write `2026-09-04`, never "last week". Runtime rows name the trigger or step order instead of a date.
- **Order before detail.** Getting the sequence right matters more than filling every row.
- With `for <reader>`, drop hashes and paths and describe the sequence in plain everyday words.
