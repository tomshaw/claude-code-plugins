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

| | Mod | What it does | Command |
| --- | --- | --- | --- |
| ✍️ | **proofread** | Fixes spelling and grammar in your prompt before Claude reads it, and highlights your prompts with the fixed words called out | `/proofread` |
| 📓 | **work-journal** | Daily, weekly and monthly reviews of your work, summarized from the prompts you typed: projects, threads, decisions and open items. In a pane, or as a webpage | `/journal` |
| ⚒️ | **laravel-tooling** | Runs Pint and Larastan after Claude edits PHP, and Pest or PHPUnit on demand, with the results in a live pane and the status line | `/laravel-tooling` |
| 📝 | **commit-msg** | Writes the commit message for your staged changes from the Claude session that made them, so it says why, not just what. Matches your repo's commit style; edit, regenerate and copy it | `/commit-msg` |

## 🧠 Skills

Instructions Claude loads when your request matches them. Ask in plain words.

| | Skill | What it does | Try |
| --- | --- | --- | --- |
| 📊 | **commit-summary** | Summarizes git commits for a day, week or month, for everyone or one author, grouped by theme with line counts and highlights | "what did I do this week?" |
| 🗺️ | **module-map** | Maps which modules exist, what each owns and exposes, and how dependencies flow: for code as it is, for what a branch or uncommitted work changed, or for a planned design. Flags circular dependencies and broken boundaries | "what did this branch change structurally?" |
| 💬 | **laymans-terms** | Explains a technical topic in simple, everyday words so a non-expert understands it on the first read. Name the reader (a client, your boss) and it writes for them | "explain this in layman's terms for a client" |
| 🧭 | **five-ws** | Asks who, what, where, when, why and how about any task, problem or plan, the way a good reporter would. You learn who it affects, what the real problem is, everything it touches, the order things happened or must happen, the real reason behind it, and a step-by-step plan with a check at each step. Then it points out what is missing or does not add up, before you start | "brief me on this before we start" |

## 📚 More

- 📖 [**docs/mods.md**](docs/mods.md): how the mods behave, setup notes and build your own
- 🧠 [**docs/skills.md**](docs/skills.md): what each skill does and how to ask for it
- 🤝 [**CONTRIBUTING.md**](CONTRIBUTING.md): where each kind of plugin goes, and how to add one
