---
name: trust-me-bro
description: "Give an instant, plain-English debrief of the work just done in this session: what changed, what it means for the user, and how sure you are about each claim (checked, pretty sure, or didn't check), based only on what actually ran. No log, no files. Use for /trust-me-bro, 'just tell me what you did', 'did it work?', 'give me the short version', 'what changed?', 'bottom line', or at the end of a task when the user wants the straight answer. Optionally names the reader: 'for my boss', 'for a client'."
argument-hint: "[what to report on] [for <reader>]"
---

# Trust me bro

Tell the user what you just did, in plain words, and be straight about how sure you are. The name is the joke: an agent's end-of-task summary usually is "trust me bro." This one isn't, because every claim is sorted by what actually backs it up in this session.

It is instant. No log, no files, no new test runs, no second reviewer. If the work needs those, point to `/paper-trail` (see the end).

## What to report on

- The arguments name it ("the login fix", "today's changes"): report on that.
- No arguments: report on the most recent task, from the user's last real request to now.
- A reader is named ("for my boss", "for a client"): write for them. Otherwise write for a smart adult who didn't watch the work.
- Nothing was done in this session: say so in one line. Don't invent work.

## Before writing, sort every claim

Go back through this session's tool history: edits made, commands run, tests run, files read. Put each thing you're about to say in one bucket:

| Mark | Means | Counts when |
| --- | --- | --- |
| ✅ **Checked** | Something you ran or read in this session shows it | A test, build or command ran **after the last edit** to that code and its output shows the result; or you read the file or data and saw it |
| 🤞 **Pretty sure** | You reasoned it out but didn't prove it | You read the code and it should work, but nothing ran it; or a check ran before a later edit |
| ⚠️ **Didn't check** | Nothing backs it | You skipped it, couldn't run it, guessed, assumed, or it depends on something you can't see (production, another service, the user's setup) |

Rules for sorting:

- **Downgrade, never upgrade.** "Tests pass" with no test run in this session is ⚠️, not ✅. A check you ran before you changed the code again is 🤞 at best.
- **Partial checks say so.** If you ran one test file, it's "the login tests pass," not "tests pass."
- **Failures are said plainly.** If something didn't work, the first line says it didn't work. Don't bury it.
- **Assumptions count.** Anything you decided because nobody was around to ask is ⚠️ and goes in "Your call."

## The reply

Keep it to one screen. Use these four parts, in this order, with these labels:

```
**What I did:** <one or two sentences>

**What it means for you:** <what changes for the user, their users or their day>

**How sure I am:**
- ✅ <claim>
- 🤞 <claim>
- ⚠️ <claim>

**Your call:** <decisions or actions only they can take, or "Nothing.">
```

- Put the most important claim first in "How sure I am," not the ✅ ones first.
- If there are ⚠️ items you could check yourself, end "Your call" with one offer: "Want me to check the ⚠️ items?" Don't run them unasked.
- No other headings, tables or preamble.

## Plain words

- Everyday words. "The tests" is fine; "the Pest suite in `tests/Feature`" is not.
- Leave out file names, function names, commit hashes and code unless the user asks or a name is the only way to say it.
- Spell out acronyms or drop them.
- Short sentences, active voice, one idea each.
- Simplify, but never say something false, and keep any warning that would change a decision.

## When to hand off to paper-trail

Add one line after "Your call" when any of these are true:

- The work touched login or permissions, stored data, money, or deleted anything.
- The user was away for the work, or will hand it to someone else.
- More than one ⚠️ is about something that would hurt if wrong.

The line: `This one's worth a real paper trail. Run /paper-trail.`

## Before sending, check

- Does every ✅ point at something that actually ran or was read in this session, after the last edit?
- Is anything that failed said in the first line?
- Could the reader follow it without looking anything up?
- Is it shorter than the conversation it summarizes?
