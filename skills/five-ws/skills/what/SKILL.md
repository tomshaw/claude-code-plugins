---
name: what
description: "Write a problem statement before any solution: separate the symptom from the real problem and from the proposed fix, check whether that fix already exists, state current vs expected, set in and out of scope, and list 'done when' checks anyone can verify. Works for software, projects, processes or any request. Use for /five-ws:what, 'what exactly is the problem', 'define this', 'what's the scope', 'what does done look like', or when a request is vague or jumps straight to a fix."
argument-hint: "[request|problem|idea] [for <reader>]"
---

# What

Produce a **problem statement**. Left alone, an agent takes the first description it hears as the problem and starts working on it. Often that description is a symptom, or a fix someone already picked. This skill pins down what is actually wrong or wanted, and what "done" means, before any work starts.

## Subject

The subject is the request, problem or idea in the arguments. With no arguments, use the latest request in the conversation.

**Evidence** comes from whatever exists: in a code repository, the code, data and its history; otherwise the documents, messages, figures and conversation the user has shared. If the subject names a file, screen, document, person or step, confirm it exists and plays the role the request assumes. If it does not, use the real one and say so.

## Procedure

1. **Quote the ask.** Restate it in one sentence, as close to the original words as possible.
2. **Split it three ways.**
   - **Symptom:** what someone saw or experienced.
   - **Problem:** the underlying condition that produces the symptom, or the unmet need behind the request.
   - **Proposed fix:** any solution already baked into the ask ("add a button", "hire another person", "make it faster"). Keep it, but never treat it as the problem.
3. **Check whether the fix already exists.** Look for the proposed fix, or something close to it, in what is there today. If it exists, the problem is why it is not working for the person asking.
4. **Current vs expected.** Describe what happens now, verified where you can (by reading the code, the data or the document, or by trying it), and what should happen instead. If you could not verify current behavior, say so.
5. **Scope.** Three lists: **In** (will change), **Out** (will not, even though someone might expect it), **Undecided** (needs a call but does not block the statement).
6. **Done when.** Three to six checks that a person can confirm by using the result or reading the output, without technical knowledge. Each check names an observable result: "A new customer signs up in under two minutes without calling support", not "onboarding is better". If blocking questions remain, write the checks against your best-guess answer and mark them conditional.
7. **Blocking questions.** List anything that must be answered before the statement holds. If any exist, stop and ask them. Do not start work on an undecided problem.

## Output

```
Problem statement: <subject>

Ask:             "<one sentence>"
Symptom:         <what was observed>
Problem:         <the real condition or need>  (verified | inferred | mixed: say which part)
Proposed fix:    <fix in the ask>  |  None
Already exists:  <what resembles the fix today> [evidence]  |  No

Now:             <current behavior> [evidence]
Should:          <expected behavior> [source]

In scope:        <items>
Out of scope:    <items>
Undecided:       <items>  |  None

Done when:       (conditional on the blocking questions, if any)
  1. <observable check>
  2. ...

Blocking questions:  <questions>  |  None, ready to start
```

## Rules

- **The problem is never a solution.** If your "Problem" line contains a verb like add, build, change or make, it is still a fix. Go one step deeper.
- **Evidence or a label.** Claims about current behavior carry a pointer (a `file:line`, a document section, a step to reproduce it, a message, something the user said) or `(inferred)`. Unknowns are written `Unknown, ask: <who would know>`.
- **Each question lives in one place.** A question that blocks the statement goes only under Blocking questions, not also under Undecided.
- **Out of scope is required.** Name at least one thing that will not change. It prevents scope creep and surprise.
- With `for <reader>`, drop file references and write in plain everyday words.
