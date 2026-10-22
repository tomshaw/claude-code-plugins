---
name: five-ws
description: "Run Who, What, Where, When, Why and How together and produce one brief, then find what no single question can: the gaps (unknowns to ask before starting) and the contradictions between answers, such as 'managers only' in the request but everyone able to do it in practice. Works for software, projects, plans, incidents or decisions. Use for /five-ws, '5 Ws', 'five Ws and how', 'full picture', 'brief me before we start', or an incident or feature write-up."
argument-hint: "[request|plan|problem|incident] [for <reader>]"
---

# Five Ws and How

Produce a **brief** from all six questions, then **cross-check** them. Each question alone gives a partial picture. The real findings are often where two answers disagree, or where one answer leaves another empty. Those disagreements are the problems nobody reported and the questions nobody asked.

## Pick the mode

- **Before work:** a request, plan or task that has not been done. The goal is to find what must be asked before starting.
- **After the fact:** something that exists or happened (a feature, a problem, an incident, a decision). The goal is a complete, evidence-backed account.

## Procedure

1. **Run each question.** Load each sibling skill with the Skill tool and follow its procedure for the subject: `five-ws:what` first (it defines the subject and "done when" the others rely on), then `five-ws:who`, `five-ws:where`, `five-ws:when`, `five-ws:why`, and `five-ws:how` last (its plan must cover what the others found). If they cannot be loaded by name, read their `SKILL.md` files from the sibling folders of this skill.
   - **Within this brief, only step 4 stops.** When a sibling says to stop and ask, record its question as an `Unknown` and carry on.
   - **Search in full, print the core.** Follow each sibling's full procedure, but print only its key line plus its flags, twins and unknowns. A sibling's rule about listing every kind governs its search, not this brief.
   - **Before work,** run `how` as an outline (steps and riskiest step). Write full proofs once the gaps are answered.
2. **Cross-check.** Run every check below and record each one as consistent, a contradiction, or not applicable:
   - **Ask × Reality:** every name, screen, file, person or fact the request cites exists and does what the request assumes.
   - **What × Who:** the intended audience in the problem statement vs who can actually use or do it.
   - **What × Where:** every in-scope item has a touchpoint, and no touchpoint marked "Must change" falls outside scope.
   - **Why × What:** meeting every "done when" check would actually achieve the goal.
   - **Why × Who:** the people the goal is for appear as Affected, and are affected for the better.
   - **When × How:** the plan's order respects every "needs first" and fits the deadlines. Before work with no fixed dates, mark it not applicable.
   - **How × Where:** every "Must change" touchpoint and every twin is covered by a plan step.
   - **How × Who:** risky steps have someone in Approves, and Informed people are told before they are affected.
3. **Collect the gaps.** Gather every `Unknown` from all six answers into one list, ordered by what blocks the most.
4. **Before work:** if any contradiction or blocking gap exists, end with the questions to ask and stop. Do not start the work. **After the fact:** end with a one-paragraph account that ties the six answers together.

## Output

```
Brief: <subject>   (before work | after the fact)

What:   <problem, one line; done-when count>
Who:    <responsible; approves; affected roles>
Where:  <count of must-change places; twins>
When:   <key dates or order>
Why:    <root cause or goal>; before work: <goal of the thing> vs <reason for this change>
How:    <step count; riskiest step>

Contradictions:
  <A × B>: <answer A> but <answer B> [evidence]
  |  None

Gaps (ask before starting):
  1. <question>, ask <who would know>
  |  None

<Before work>   Ready to start | Blocked on <n> questions
<After the fact> In short: <one paragraph>
```

## Rules

- **Contradictions are the main output.** Report each with the evidence from both sides. Do not resolve one by picking a side; flag it and let the person decide.
- **Evidence follows the sibling skills.** Every claim has a pointer or `(inferred)`; missing answers are `Unknown`, never a guess.
- **Stay compact.** The brief fits on one screen. Point to the full single-question output only when asked.
- With `for <reader>`, drop references and write the whole brief in plain everyday words.
