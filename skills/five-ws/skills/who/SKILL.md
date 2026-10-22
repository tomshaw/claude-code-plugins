---
name: who
description: "Build a people map for a change, decision, problem or task: who is responsible, who approves, who is affected and how, who must be told, and whether who CAN use or do it matches who SHOULD. Works for software, projects, processes or any plan. Use for /five-ws:who, 'who does this affect', 'who owns this', 'who needs to know', 'who can access this', 'stakeholders', or before a change that alters what people see, get or can do."
argument-hint: "[change|decision|problem|task] [for <reader>]"
---

# Who

Produce a **people map**. Left alone, an agent changes things without thinking about the people on the other end: the role that loses a button, the customer whose bill shifts, the person who should have approved it. This skill makes those people explicit before anything ships.

## Subject

The subject is the change, decision, problem or task in the arguments. With no arguments, use the work in the current conversation. If the subject is unclear, ask one question to pin it down, then continue.

**Evidence** comes from whatever exists: in a code repository, the code, its history and linked issues; otherwise the documents, org charts, messages and conversation the user has shared. If the subject names a file, function, screen, team or person, confirm it exists and plays the role assumed. If it moved or is wrong, use the real one and note it under Missing.

## Procedure

1. **Find who can use or do it today.** Find every gate on the subject and record where each one is.
   - In software: permission and role checks, policies, middleware, route guards, menu or navigation visibility, feature flags, account scoping. If the subject has no entry point of its own (a component, dialog, job or service), trace what opens or calls it up to the entry point, and record the gates along that path.
   - Elsewhere: sign-offs, policies, budgets, who holds the keys, logins or authority.
   - Also record checks that are **missing** where you would expect one, such as an action that loads any record by its ID without checking who is asking.
2. **Find who it reaches.** Look for every way the subject touches a person without them asking: emails, notifications, documents, exports, reports, invoices, announcements, scheduled runs, customer-facing pages. Write one line per channel, not one per place that uses it.
3. **Find who built and owns it.** In a code repository: `git log --format='%an' -- <paths> | sort | uniq -c | sort -rn`, `git blame` on the key lines, and CODEOWNERS or similar files. Elsewhere: the named owner of the document, plan, budget or process. Owners are the main recent contributors, not every name.
4. **Sort people into four groups.**
   - **Responsible:** does the work or owns it.
   - **Approves:** must sign off before it happens (product owner, client, manager, finance, compliance).
   - **Affected:** whose screen, data, workflow, money, schedule or inbox changes. One line each on what changes for them, and whether it is better, worse or different.
   - **Informed:** needs to know but is not affected directly (support, sales, account managers, the client contact).
5. **Access check.** Compare who **should** have access (from the request, documents, issues or stated intent) with who **can** (from step 1). Every mismatch is a flag: too open, too closed, or a gate in one place but not another (a hidden menu item whose page is still reachable; a form only managers see, but anyone can submit it by email).
6. **Missing people.** Name any group with no one in it, and any role the subject plainly needs but nothing mentions.

## Output

```
People map: <subject>

Responsible   <name or role> [evidence]
Approves      <name or role> [evidence]  |  Unknown, ask: <who would know>
Affected      <role>: <what changes for them> (better | worse | different) [evidence]
Informed      <role>: <why they need to know>

Access
  Should use:  <roles> [source]
  Can use:     <roles, or "anyone signed in" / "anyone"> [gate locations]
  Flags:       <mismatch or missing check, one per line>  |  None

Missing:       <empty group, unmentioned role, or wrong starting point>  |  None
```

## Rules

- **Evidence or a label.** Every line carries a pointer (a `file:line`, a commit, an issue, a document, a message, something the user said) or the tag `(inferred)`. If it cannot be found, write `Unknown, ask: <who would know>`. Never fill a slot with a plausible guess.
- **Roles over names** for the people affected. Use names only for owners and approvers found in the record, and only when they help someone know who to ask.
- **Affected means a real change.** Do not list a role whose experience is identical before and after.
- With `for <reader>` (a client, a manager), drop file references and write in plain everyday words.
