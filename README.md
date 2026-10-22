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
claude plugin install trust-me-bro@tomshaw
claude plugin install scrutinize@tomshaw
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

Plugins built on function hooks: they change what Claude Code shows and does, live. Click a name for the full guide.

| | Mod | Why you want it | Command |
| --- | --- | --- | --- |
| ✍️ | [**proofread**](docs/mods.md#proofread) | **Type fast, never get misread.** Typos and grammar are fixed before Claude reads your prompt, with every fix highlighted. Code and paths are left alone | `/proofread` |
| 📓 | [**work-journal**](docs/mods.md#work-journal) | **Know what you did without writing it down.** Your day, week or month, written up from your prompts: projects, threads, decisions and open items | `/journal week` |
| ⚒️ | [**laravel-tooling**](docs/mods.md#laravel-tooling) | **Claude's PHP, checked before you have to.** Pint and Larastan run after every edit, tests on demand, results live in a pane, and one key turns failures into a fix prompt | `/laravel-tooling` |
| 📝 | [**commit-msg**](docs/mods.md#commit-msg) | **Commit messages that remember why.** Written from the session that made the change, in your repo's style. You edit it, copy it and commit it yourself | `/commit-msg` |

## 🧠 Skills

Instructions Claude loads when your request matches them. Ask in plain words. Click a name for the full guide.

| | Skill | Why you want it | Try |
| --- | --- | --- | --- |
| 📊 | [**commit-summary**](docs/skills.md#commit-summary) | **Your standup, written by your commits.** Any day, week or month, for anyone, grouped by theme with line counts and highlights | "what did I do this week?" |
| 🗺️ | [**module-map**](docs/skills.md#module-map) | **See the shape of a change, not just its lines.** Modules, dependencies and boundaries for code as it is, a branch, or a plan, with problems flagged | "what did this branch change structurally?" |
| 💬 | [**laymans-terms**](docs/skills.md#laymans-terms) | **Explain it so anyone gets it.** Everyday words, written for the reader you name, simplified but never wrong | "explain this for a client" |
| 🧭 | [**five-ws**](docs/skills.md#five-ws) | **Ask what a good reporter would, before you start.** Who, what, where, when, why and how, then where the answers don't add up | "/five-ws add an export button" |
| 🔬 | [**paper-trail**](docs/skills.md#paper-trail) | **Stop taking Claude's word for it.** Every decision logged with proof you can open, false claims caught, and a second model's review. Check the work in minutes instead of redoing it | "leave a paper trail" |
| 🤙 | [**trust-me-bro**](docs/skills.md#trust-me-bro) | **The straight answer, right now.** What changed and what it means for you, in plain words, with every claim marked checked, pretty sure or didn't check | "did it work?" |
| 🔎 | [**scrutinize**](docs/skills.md#scrutinize) | **A second set of eyes that has to show its work.** Another model reviews it blind, every finding is checked, and you get only what held up, ranked, with a report page | "/scrutinize the latest changes" |

## 📚 More

- 📖 [**docs/mods.md**](docs/mods.md): how the mods behave, setup notes and build your own
- 🧠 [**docs/skills.md**](docs/skills.md): what each skill does and how to ask for it
- 🤝 [**CONTRIBUTING.md**](CONTRIBUTING.md): where each kind of plugin goes, and how to add one
