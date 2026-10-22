---
name: where
description: "List every place a change touches, not just the one in front of you: what people see, the rules and calculations, stored data, settings, access, documents and messages sent out, automatic tasks, checks and help text, plus 'twins' that repeat the same rule or wording and must change together. Works for software, documents, processes or a business. Use for /five-ws:where, 'where else does this need to change', 'where is this used', 'what else touches this', or before renaming something or changing a formula, field, label, price or rule."
argument-hint: "[change|feature|name|rule] [for <reader>]"
---

# Where

Produce a **touchpoint list**. Left alone, an agent fixes the spot it was shown and misses the places that must change with it: the export that recomputes the same total, the PDF with its own copy of the label, the price list that repeats the old rate, the help page. This skill sweeps every kind of place on purpose, so missed spots are found before release, not after.

## Subject

The subject is the change, feature, name or rule in the arguments. With no arguments, use the change in the current conversation.

**Evidence** comes from whatever exists: in a code repository, the files themselves; otherwise the documents, templates, sites, spreadsheets and systems the user can point to. Ask for access to what you cannot see rather than guessing it is unaffected.

## Procedure

1. **Anchor.** Find the primary location of the subject. If the starting point you were given does not contain it, say so and anchor where it actually lives. Collect its search terms: names in code (class, function, route, column, config and translation keys), and the exact wording people see. For a change to a formula or rule, write one line on how it behaves today.
2. **Sweep every kind of place.** For each kind below, search with the terms from step 1 and record what you found, or `none found` with the terms you searched. If a kind cannot exist for this subject (no stored data in a printed flyer), mark it `not applicable` once. Never skip a kind silently.
   - **What people see:** screens, pages, forms, signs, printed material (in code: views, components, templates)
   - **Ways in:** links, menus, entry points (in code: routes, endpoints, controllers, commands)
   - **Rules and calculations:** business logic, policies, formulas, price lists
   - **Stored data:** records, spreadsheets, databases (in code: tables, columns, migrations, models)
   - **Settings:** options, configuration, feature flags, environment
   - **Access:** permissions, roles, who can see or approve it
   - **Sent out:** documents, exports, PDFs, emails, notifications, reports, invoices, APIs
   - **Automatic tasks:** scheduled jobs, queues, event handlers, recurring reminders
   - **Reference data and templates:** seed data, lookup lists, starter files, form templates
   - **Copies:** caches, search indexes, snapshots, printed or exported copies already in circulation
   - **Checks:** tests, fixtures, checklists, audits
   - **Explanations:** docs, help text, training material, translations, AI prompts
3. **Find twins.** Look for places that repeat the subject instead of referring to it: the same formula, constant, rule, query, wording or price written somewhere else. Search for the literal values and, for a formula, its arithmetic shape (operators and constants such as `1 - m`, `* 0.01`), not just the names. A twin that already disagrees is still a twin; flag the difference. Twins are the spots most often missed, because nothing links them.
4. **Find what depends on it.** Include places that rely on how the subject behaves today without naming it, such as a stored adjustment that assumes the current order of a calculation.
5. **Mark each place.** **Must change**, **Check** (might be affected, verify), or **Unaffected** (found, but safe, with the reason).

## Output

```
Touchpoints: <subject>

Anchor: <primary location>
Current behavior: <one line, for a formula or rule>
Searched for: <terms>

| Kind | Place | Status | Why |
|---|---|---|---|
| Sent out | <file:line or document> | Must change | <reason> |
| ... |

Twins (must change together):
  <place A>  ↔  <place B>: <what they both repeat; note any disagreement>
  |  None found

Kinds with nothing found: <kind (terms searched)>
Not applicable: <kinds>
```

## Rules

- **Every kind gets a row, a line in "nothing found", or "not applicable".** A silent gap reads as "checked", which is the failure this skill exists to prevent.
- **Evidence for every row.** Each place is something you actually opened (a `file:line`, a document section, a page), not a guess from a name.
- **Unaffected needs a reason.** "Reads the value but only displays it" is a reason; "probably fine" is not.
- With `for <reader>`, describe places as screens, documents and messages a person would recognize, without file paths.
