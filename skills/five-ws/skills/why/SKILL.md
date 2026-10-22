---
name: why
description: "Find the real reason. For a problem: a chain of 'why' steps, each backed by evidence, down to a root cause whose fix makes the problem impossible, not just less likely. For a request, decision or design: the goal behind it, from the record (commits, issues, documents, messages). Works for software, projects, processes or decisions. Use for /five-ws:why, 'why did this happen', 'root cause', 'why is it built this way', 'why did they change this', 'why do they want this', or before removing something that looks pointless."
argument-hint: "[problem|request|decision] [for <reader>]"
---

# Why

Produce a **root cause** or a **purpose**. Left alone, an agent stops at the first plausible cause and fixes that, or invents a believable reason for why something exists. This skill keeps asking until the evidence runs out, and says "Unknown" rather than fill the gap with a story.

## Pick the track

- **Cause:** something went wrong. Find why it happened.
- **Purpose:** something was requested, built, changed or removed on purpose. Find why. Use this track even when the question reads "why did X get deleted" or "why did they change Y", unless the change broke something.

**Evidence** comes from whatever exists: in a code repository, the code, git history and linked issues; otherwise documents, data, messages, meeting notes and people's accounts.

## Cause procedure

1. State the problem in one sentence.
2. Ask "why did that happen?" and answer with evidence: a record, data, a log, a reproduction, a witness. Each answer becomes the next question.
3. Stop when one of these is true:
   - You reach a cause where fixing it makes the problem **impossible**, not just less likely. That is the root cause.
   - The evidence runs out. Write `Unknown` and what would settle it.
4. Separate the **trigger** (what set it off this time) from the **root cause** (why it was able to happen at all). Fixing only the trigger leaves the problem waiting for the next one.
5. Test the fix idea against the chain: does it break the chain at the root, or only patch a later link? A guard that hides a bad state is a patch, unless that state is legitimate.

## Purpose procedure

1. **Dig up the record.** In a code repository: `git log -S'<key line>'`, `git blame -w -C` on the lines, then `git show <commit>` for the message, and follow linked issues and pull requests. Elsewhere: the documents, decision records, emails and meeting notes behind it.
2. **For "why does it NOT do X"**, there is nothing left to point at. Search for the removed version instead: in git, `git log -S'<likely removed text>'` or `-G'<pattern>'`, then `git show` each hit; elsewhere, earlier versions of the document or policy. An add-then-remove pair marks where the decision was made.
3. **For a request**, ask what goal it serves: whose pain it removes, what they do today instead, what happens if it is never done, and how anyone would know it worked.
4. Record any alternatives that were considered, and why they lost if the record says so.
5. If the record is silent, say so. A reason you deduced is labeled `(inferred)` and is never presented as the original intent.

## Output

Print only the block for the chosen track.

```
Why: <subject>   (cause)

  Problem:  <what happened>
  Why 1:    <answer> [evidence]
  Why 2:    <answer> [evidence]
  ...
  Root:     <root cause> [evidence]  |  Unknown, would settle it: <check>
  Trigger:  <what set it off this time>
  Fix at:   <the link to fix, and why that one>
```

```
Why: <subject>   (purpose)

  Goal:               <the goal> [source]
  For:                <whose pain>
  Without it:         <what happens>
  Success looks like: <measure>
  Alternatives:       <option>, rejected because <reason> | reason not recorded  |  None recorded
```

For something that already exists, For, Without it and Success looks like may be `—` when the record is silent. Do not pad them with guesses.

## Rules

- **Every link needs evidence.** A `file:line`, a commit, an issue, a document, a log line, a reproduction or a named person's account. Otherwise `(inferred)`, and the chain stops being proven at that link.
- **Check a source against what it shows.** A commit message against its diff, a report against its data, a summary against the meeting notes. Cite what it shows, not only what it claims.
- **Never invent intent.** "It was probably added for performance" is not a finding.
- **Five is a guide, not a target.** Stop when you reach the root or the evidence ends, whichever comes first.
- With `for <reader>`, drop references and explain the chain in plain everyday words.
