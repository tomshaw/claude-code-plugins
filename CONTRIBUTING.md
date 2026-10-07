# 🤝 Contributing

## 🗂️ Where things go

Every plugin lives in a folder for its kind, and every folder is a complete plugin with its own `.claude-plugin/plugin.json`:

| Folder | Holds |
| --- | --- |
| `mods/` | Mods: plugins built on function hooks (`hooks/register.tsx`) |
| `skills/` | Plugins that ship skills (`skills/<skill>/SKILL.md`) |
| `agents/` | Plugins that ship subagent types (`agents/*.md`) |
| `commands/` | Plugins that ship slash commands (`commands/*.md`) |

A plugin that mixes kinds goes in the folder for what it mainly is.

## 🧪 Try a plugin locally

```sh
claude --plugin-dir <kind>/<name>
```

## ✅ Check it

```sh
claude plugin validate <kind>/<name>
claude plugin test <kind>/<name>
```

Type-check a mod once Claude Code has loaded it with `--plugin-dir` (that writes `.claude-plugin/types/`):

```sh
npx -p typescript tsc -p mods/<name>
```

💡 `claude plugin test` may refuse to run inside a Claude Code session. If it does, run it with `CLAUDE_CONFIG_DIR` set to another config dir.

```sh
CLAUDE_CONFIG_DIR=$(mktemp -d) claude plugin test mods/<name>
```

## 📦 Add or change a plugin

- 📁 Put it in `<kind>/<name>/`. Mods keep their tests in `mods/<name>/tests/`
- 🧾 Add an entry to `.claude-plugin/marketplace.json`
- 📋 Add a row to the README table for its kind, and notes to `docs/`
- 🔢 Changed a plugin? Bump its version in its `plugin.json` and in `.claude-plugin/marketplace.json`

Mod gotchas: [Build your own](docs/mods.md#%EF%B8%8F-build-your-own).
