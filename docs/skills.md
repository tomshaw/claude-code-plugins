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
