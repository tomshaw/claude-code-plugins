---
name: how
description: "Turn work into a step plan where every step has a method, a tool and a proof: the check or observation that shows the step worked before the next one starts. Riskiest step goes first, and the plan ends by checking against what 'done' means. Works for code changes, projects, moves, launches or any task. Use for /five-ws:how, 'how do we do this', 'how should I fix this', 'step by step plan', 'walk me through doing X', or any job too big to do in one go."
argument-hint: "[task|fix|change] [for <reader>]"
---

# How

Produce a **step plan with proof**. Left alone, an agent plans in steps but proves only at the end, if at all: "it compiles" or "it's sent" stands in for "it works", and a mistake in step two surfaces in step six. This skill makes every step end in a state someone can check, so problems show up where they start.

## Subject

The subject is the task, fix or change in the arguments. With no arguments, use the work in the current conversation. If a "done when" list exists (from the `what` skill or the conversation), the plan must end by meeting it. If none exists, write a short one first.

## Procedure

1. **Find the tools and rules that already exist.**
   - In a code repository: package and build scripts, task runners, framework commands, test runners, linters, existing verification skills. Check what each one actually covers (which files and paths, what it skips). A tool that skips the files you change proves nothing about them.
   - Elsewhere: the checklists, templates, spreadsheets, calendars and systems the work already uses.
   - Read the project's or team's rules (contributing guides, agent instructions, policies). They limit which proofs you may use, for example no tests until a reviewer approves.
2. **Break the work into steps** small enough that each ends in a checkable state. A step that cannot be checked by itself is merged into the next or split differently. When the same change repeats across many places, group them into batches by risk or area, with one proof per batch, not one step per place.
3. **Give every step four parts:**
   - **Do:** the action.
   - **With:** the tool, command or method.
   - **Proof:** the exact check that shows it worked, and what a pass looks like. Prefer the real thing (open the page, run the command, read the output file, confirm the email arrived) over a stand-in. If the rules defer the strongest proof, use the strongest one allowed and list the deferred one in the final check.
   - **Undo:** how to back it out, only for risky steps (data changes, deletions, money, anything other people see).
4. **Order by risk.** Put the step most likely to fail, or that would change the plan if it fails, as early as its dependencies allow.
5. **Final check.** The last step proves each "done when" item, one by one.
6. **If asked to carry it out,** do the steps in order and record each proof result as you go. Stop at the first failed proof and report it rather than pushing on.

## Output

```
Plan: <subject>

Done when:
  D1 <check>
  D2 ...

1. Do:    <action>
   With:  <tool or method>
   Proof: <check> → pass looks like <result>
   Undo:  <how to reverse>      (risky steps only)
2. ...

Riskiest step: <n>, because <reason>
Final check:   D1 <how it is proven>; D2 ...; deferred: <proofs the rules hold back, and when they run>
```

## Rules

- **No step without a proof.** "Looks right" and "should work" are not proofs.
- **Proofs use the real result.** Run it, open it, read the actual value. A passing type check proves types, not behavior; a sent message proves sending, not receipt.
- **Use what exists.** Do not invent a script, form or process when one already does the job.
- With `for <reader>`, drop commands and describe each step and how you will know it worked, in plain everyday words.
