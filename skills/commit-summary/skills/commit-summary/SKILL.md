---
name: commit-summary
description: Summarize git commits for a day, week or month (today by default), for everyone or for one author, grouped by theme with lines-of-code changes, per-author counts and highlights. Use when the user asks for a standup, "what did I do this week", "summarize this month's commits", "what has <name> worked on", a weekly or monthly recap, a work log, or a commit summary for any date range. Works in any git repo.
argument-hint: "[today|yesterday|week|last week|month|last month|<date>|<from>..<to>] [author]"
---

# Commit Summary

Summarize the commits in a time window: who did what, grouped by theme, with line counts and highlights. The window defaults to **today** and the author to **everyone**. Both can be changed in plain words ("my work this week", "Jane's commits last month").

## Step 1: Resolve the window

Work out real dates from today's date in the local timezone, then pass them to git as explicit bounds: `--since="<YYYY-MM-DD> 00:00" --until="<YYYY-MM-DD> 23:59:59"`. Don't rely on shell date arithmetic, which differs between macOS and Linux.

| The user says | Window |
| --- | --- |
| nothing, "today", "daily" | today |
| "yesterday" | yesterday |
| a weekday ("Tuesday") | the most recent such day, today included |
| "this week", "weekly", "week" | Monday of this week through today |
| "last week" | Monday through Sunday of the previous week |
| "this month", "monthly", "month" | the 1st of this month through today |
| "last month" | the whole previous calendar month |
| "past 7 days", "last 30 days" | a rolling window ending today |
| a date (`2026-10-05`) | that day |
| a range (`2026-09-01..2026-09-15`, "since Sept 1") | from the first date through the second, or through today |

Name the resolved window in the output ("Week of Mon Oct 5 – Wed Oct 7, 2026") so the user can check it.

## Step 2: Resolve the author

- **Everyone** unless the user names someone.
- "me", "my", "I" means the current git user: `git config user.name`, falling back to `git config user.email`.
- A name goes to `--author=<name>`, which matches part of the name or email. Commit names can differ from display names (a display name "Jane Doe" may commit as `jdoe42`). If the name returns nothing, list the window's authors with `git log --since=... --until=... --all --format='%an <%ae>' | sort -u`, pick the likely match, and say which one you used. Ask only if it's ambiguous.

## Step 3: Gather the data

Include all local branches with `--all` unless the user names a branch, then use that branch instead. Leave merge commits out of themes and line counts with `--no-merges`, but count them separately. Substitute the real bounds and author for `$SINCE`, `$UNTIL` and `$AUTHOR` (drop `--author` for everyone).

```bash
# Commits per author (non-merge)
git log --no-merges --since="$SINCE" --until="$UNTIL" --all $AUTHOR --format='%an' | sort | uniq -c | sort -rn

# Every commit: hash, author, date and time, subject
git log --no-merges --since="$SINCE" --until="$UNTIL" --all $AUTHOR --date=format:'%Y-%m-%d %H:%M' \
  --format='%h|%an|%ad|%s'

# Merge commits, counted separately
git log --merges --since="$SINCE" --until="$UNTIL" --all $AUTHOR --format='%h|%an|%s'

# Lines added and removed, per commit, with its author
git log --no-merges --since="$SINCE" --until="$UNTIL" --all $AUTHOR --shortstat --format='@%an' \
  | awk '/^@/{a=substr($0,2)} /changed/{print a"|"$0}'

# Most-changed files
git log --no-merges --since="$SINCE" --until="$UNTIL" --all $AUTHOR --name-only --format= \
  | grep -v '^$' | sort | uniq -c | sort -rn | head -15
```

For a week or a month, also count commits per day to show the rhythm of the period:

```bash
git log --no-merges --since="$SINCE" --until="$UNTIL" --all $AUTHOR --date=format:'%Y-%m-%d %a' --format='%ad' \
  | sort | uniq -c
```

Sum the `--shortstat` lines per author for their totals. A commit with no `changed` line (empty, or a pure mode change) adds nothing.

## Step 4: Find the themes

Group the commits into themes by what was being worked on:

1. **The conventional-commit prefix and scope.** `feat(status):` hints at a "status" theme. The prefix alone isn't a theme, because `feat:` covers many unrelated features.
2. **The subject.** Cluster commits whose subjects share a subsystem or noun ("history table", "filter options", "trucks/buyout").

Name each theme in plain language ("Calculation history table", "Grid filter performance"), not by prefix.

## Step 5: Write the summary

Scale the detail to the window. A day lists its commits; a month can't.

**Every window:**
- A one-line headline: the main theme or the busiest area.
- **Overview:** the window, total commits (merges separately), contributors, and lines changed (`+X / −Y` across `N` files).
- **Per-author table:** author · commits · `+added / −removed` · their main focus in a few words. Skip it for a single author.

**By window size:**

| Window | Themes | Extra |
| --- | --- | --- |
| A day | Per author, each theme with its commit subjects (tidied, prefixes dropped) | Time span, first to last commit |
| A week | Per author, each theme with a one-line summary and its commit count. List subjects only for small themes (3 or fewer) | Commits per day, busiest day |
| A month | The month's top themes across everyone, each with a short summary, its contributors and commit count. No commit lists | Commits per week, busiest week, themes that started or wrapped up |

**Highlights**, whichever apply:
- The largest commit by lines changed, and the most-changed files or subsystem.
- Notable commits: a revert, a security or access change, a data-loss fix, a dependency bump, a fix that closes a reported bug.
- Feature branches merged in the window, by name.
- Several authors working on the same area.

## Rules

- Report only what git shows. If the window has no commits, say so, then show the most recent day that has some: `git log -1 --all $AUTHOR --format='%ad' --date=short`. Never invent activity.
- Describe the work the way the commit messages do. Don't judge it or guess beyond what they and the line counts support.
- Keep it short and easy to read in a terminal. If the author or theme table would be large (4+ authors, or many themes), offer a visual HTML page instead, using the `visual-explainer` skill if it's installed.
- Use the current repo. If the current folder isn't inside a git repo, say so.
