---
name: module-map
description: Produce a structural map of code — which modules exist, what each owns, what it exposes, and how dependencies flow — for a subsystem as it is now, for what a branch, PR, commit range or uncommitted work changed, or for a proposed design. Use when the user asks to "map this module", "show the architecture of X", "what did this branch change structurally", "how does this PR change the dependencies", "module map", or wants a dependency overview before or after a change. Works in any git repo.
argument-hint: "[path|feature|range|plan]"
---

# Module Map

Produce a structural map of code: which modules exist, what each owns, what it exposes, and how dependencies flow. The goal is to make architecture visible, especially how a change alters it, which line-by-line diffs hide.

Assume nothing about the language, framework, or design style. Every judgment in this skill — what a module is, what counts as a dependency, what is public, what a violation is — comes from reading the codebase in front of you.

## Pick a mode

Infer the mode from the request; ask only if truly ambiguous.

- **existing** — map a subsystem as it is now. Input: a path, package, or feature name.
- **changes** — map what a branch, PR, commit range, or uncommitted work touched. Default range: current branch plus uncommitted work vs. its merge base with the default branch; fall back to the last commit.
- **proposed** — map a plan or design that isn't implemented yet. Input: a description, spec, or sketch.

## Scope

- Default scope is the target files plus their direct neighbors (modules they rely on and modules that rely on them). Do not map the whole repo unless explicitly asked.
- A "module" is whatever unit this codebase naturally groups code into, with a cohesive responsibility. Pick one granularity and use it consistently.
- Cap the map at ~15 modules. If there are more, group by parent directory and say so.

## Resolve the base (changes mode)

Never assume the default branch is called `main`. Resolve it in this order and use the first that works:

1. `git symbolic-ref --short refs/remotes/origin/HEAD` (strip the `origin/` prefix).
2. Whichever of `main` or `master` exists locally (`git rev-parse --verify --quiet <name>`).
3. If neither exists, use `HEAD~1` and say so.

Then `base=$(git merge-base HEAD <default-branch>)`. If the user named a range, PR, or commit, use that instead.

If the user did not name a range and the file list from step 1 below comes back empty (for example, on the default branch with a clean tree, where the merge base is `HEAD` itself), set `base=HEAD~1`, collect the files again, and say the map covers the last commit. If `HEAD~1` does not exist, say there is nothing to compare and stop. An empty file list is never grounds for "No structural change"; that verdict is only for changes that exist but are internal.

## How to build it

1. Collect the files in scope. For changes mode, take the union of:
   - `git diff --name-only <base>` — committed and uncommitted (staged and unstaged) changes since the base.
   - `git ls-files --others --exclude-standard` — new untracked files.

   For an explicit commit range with no uncommitted work wanted, use `git diff --name-only <from>..<to>`.
2. Learn how this codebase connects its parts before mapping anything. Read its entry points, configuration, and a sample of existing code to see every way one piece of code reaches another — whether written as a direct reference or resolved some other way. A dependency is any link where one module relies on another, however it is expressed.
3. For each module, determine:
   - **Responsibility** — one line, what it owns.
   - **Public surface** — what other modules actually use from it.
   - **Depends on** — the internal modules it relies on. Leave out the language's standard library and ordinary external libraries unless one marks a boundary to an outside system. Note the mechanism when a link isn't a direct reference (e.g. `a → b (<mechanism>)`).
4. For changes and proposed modes, build the "before" map too, then diff. Read each in-scope file as it was at the base with `git show <base>:<path>`; a path missing at the base means the file is new. Never reconstruct the before state from memory or from the diff alone.
5. Check for violations (below).

## Output format

Always use this structure so maps are comparable over time.

```
## Module map: <scope> (<mode>)

| Module | Responsibility | Public surface | Depends on |
|---|---|---|---|
| <module> | <one line> | <what others use> | <modules, or —> |

### Structural changes   (changes / proposed modes only)
+ added module: <module>
~ <module>: now depends on <module>
- removed dependency: <module> → <module> (<what replaced it, if anything>)

### Flags
⚠ <violation> — <file:line or module> — <why it matters>

### Summary
1–3 sentences: what the structure is, or what the change did to it.
```

Mark changes with `+` added, `-` removed, `~` changed. Omit empty sections.

When the map has more than ~6 modules, add a Mermaid dependency graph after the table (`graph LR`, one edge per dependency; in diff modes, style added edges green and removed edges red/dashed).

## Flags to check

- Circular dependencies.
- Bypassing a boundary the codebase itself establishes — only when existing code shows that boundary is followed elsewhere.
- Using parts of another module that the rest of the codebase treats as private to it.
- A dependency on an outside system spreading to more modules when it was previously confined to one.
- A module whose responsibility no longer fits in one line (it is doing two jobs).
- Public surface growth: a change that significantly widens what a module offers to others.

Only flag what you can point to in the code or plan. Don't speculate, and don't judge the codebase against a design style it doesn't follow.

## When there is nothing structural

If a change only edits bodies inside existing modules with no new modules, dependencies, or surface changes, say: "No structural change — edits are internal to <modules>." and stop. Do not pad the output with a file list.

## Proposed mode notes

- Derive the map from the caller's intended usage first, then the modules needed to serve it.
- Map against the current codebase: show which existing modules gain or lose dependencies, not just the new ones.
- If the plan is too vague to place responsibilities, list the open questions instead of guessing.
