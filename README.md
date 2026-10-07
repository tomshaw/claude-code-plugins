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

## 🧠 Skills

Instructions Claude loads when your request matches them. Ask in plain words.

| | Skill | What it does | Try |
| --- | --- | --- | --- |
| 📊 | **commit-summary** | Summarizes git commits for a day, week or month, for everyone or one author, grouped by theme with line counts and highlights | "what did I do this week?" |

## 📚 More

- 📖 [**docs/mods.md**](docs/mods.md): how the mods behave, setup notes and build your own
- 🧠 [**docs/skills.md**](docs/skills.md): what each skill does and how to ask for it
- 🤝 [**CONTRIBUTING.md**](CONTRIBUTING.md): where each kind of plugin goes, and how to add one
