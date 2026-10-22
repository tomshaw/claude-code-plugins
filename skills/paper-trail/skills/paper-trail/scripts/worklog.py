#!/usr/bin/env python3
"""worklog: an append-only decision log an agent keeps while it works unattended.

One TSV row per real decision. Evidence must be checkable, so this tool
resolves it (commits, file lines, captured command output) instead of trusting
what was typed. Standard library only.

  worklog.py init [--run NAME] [--why TEXT]   start a run (writes the start row)
  worklog.py add --kind K --phase P --decision D --why W --evidence E --result R [--ref IDS]
  worklog.py run [--label L] -- CMD...          run a command, capture output as evidence
  worklog.py check [--online]                   verify the log; exit 1 on errors
  worklog.py show [--all]                       readable report (Markdown)
  worklog.py packet                             review bundle for a second-opinion model
  worklog.py reviewers                          list reviewer CLIs found on PATH
  worklog.py config [KEY=VALUE]                 read or set settings (e.g. reviewer=codex)
  worklog.py promote                            copy the log into docs/work-log/ for committing
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

DIR_NAME = ".paper-trail"
COLUMNS = ["id", "ts", "run", "kind", "phase", "decision", "why", "evidence", "result", "ref"]
KINDS = {
    "start": "a run or chat picks up the work",
    "choice": "picked one option over others",
    "done": "a piece of work finished, with its test result",
    "pivot": "changed direction",
    "revert": "undid earlier work",
    "blocker": "stuck; needs something it can't get",
    "fix": "a broken test or build was fixed",
    "correct": "an earlier row was wrong; this replaces it",
}
NEEDS_REF = {"correct", "revert"}
EXTERNAL = ("pr", "issue", "url")
REVIEWER_CLIS = [
    # (name, family, how to call it with the packet on stdin)
    ("codex", "OpenAI", "codex exec -"),
    ("gemini", "Google", "gemini -p \"$(cat PACKET)\""),
    ("llm", "depends on its default model", "llm < PACKET"),
    ("ollama", "local open-weights model", "ollama run <model> < PACKET"),
]


# ---------- paths and state ----------

def git(*args, cwd=None):
    try:
        r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    except FileNotFoundError:
        return None
    return r.stdout.strip() if r.returncode == 0 else None


def root():
    return git("rev-parse", "--show-toplevel") or os.getcwd()


def paths():
    base = os.path.join(root(), DIR_NAME)
    return {
        "dir": base,
        "log": os.path.join(base, "log.tsv"),
        "state": os.path.join(base, "state.json"),
        "out": os.path.join(base, "out"),
    }


def load_state(p):
    try:
        with open(p["state"]) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"run": None, "digests": [], "config": {}}


def save_state(p, state):
    with open(p["state"], "w") as f:
        json.dump(state, f, indent=2)


def row_digest(line):
    return hashlib.sha256(line.encode()).hexdigest()[:16]


def read_rows(p):
    if not os.path.exists(p["log"]):
        return None, []
    with open(p["log"], encoding="utf-8") as f:
        lines = f.read().split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    header = lines[0] if lines else ""
    return header, lines[1:]


def parse(line):
    cells = line.split("\t")
    return dict(zip(COLUMNS, cells + [""] * (len(COLUMNS) - len(cells)))), len(cells)


def clean(text):
    # One row per line, one cell per column: tabs and newlines can't survive.
    return re.sub(r"\s*[\t\r\n]+\s*", " / ", str(text if text is not None else "").strip())


def now():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def need_log(p):
    if not os.path.exists(p["log"]):
        sys.exit("No log yet. Start one with: worklog.py init --run <name> --why <task>")


def append(p, state, cells):
    line = "\t".join(clean(c) for c in cells)
    with open(p["log"], "a", encoding="utf-8") as f:
        f.write(line + "\n")
    state["digests"].append(row_digest(line))
    save_state(p, state)


# ---------- ids and refs ----------

def expand_ids(spec):
    ids = []
    for part in filter(None, (s.strip() for s in (spec or "").split(","))):
        if "-" in part:
            a, b = part.split("-", 1)
            ids.extend(range(int(a), int(b) + 1))
        else:
            ids.append(int(part))
    return ids


def compress_ids(ids):
    ids = sorted(set(ids))
    out, i = [], 0
    while i < len(ids):
        j = i
        while j + 1 < len(ids) and ids[j + 1] == ids[j] + 1:
            j += 1
        out.append(str(ids[i]) if i == j else f"{ids[i]}-{ids[j]}")
        i = j + 1
    return ",".join(out)


# ---------- evidence ----------

def split_evidence(text):
    return [e.strip() for e in (text or "").split(";") if e.strip()]


def evidence_kind(item):
    m = re.match(r"^(commit|file|out|pr|issue|url):(.+)$", item)
    return (m.group(1), m.group(2).strip()) if m else (None, item)


def resolve(item, base, online=False):
    """Return (level, message) where level is 'ok', 'warn' or 'error'."""
    kind, val = evidence_kind(item)
    if kind is None:
        return "error", f"not checkable evidence: {item!r} (use commit:, file:, out:, pr:, issue: or url:)"

    if kind == "commit":
        sha = git("rev-parse", "--verify", "--quiet", f"{val}^{{commit}}", cwd=base)
        if not sha:
            return "error", f"commit {val} not found"
        if git("merge-base", "--is-ancestor", sha, "HEAD", cwd=base) is None:
            return "warn", f"commit {val} exists but is not on the current branch (rebased or dropped?)"
        return "ok", ""

    if kind == "file":
        m = re.match(r"^(.+?)(?::(\d+)(?:-(\d+))?)?(?:@([0-9a-fA-F]{4,40}))?$", val)
        path, a, b, sha = m.group(1), m.group(2), m.group(3), m.group(4)
        if sha:
            content = git("show", f"{sha}:{path}", cwd=base)
            if content is None:
                return "error", f"{path} not found at {sha}"
            n = len(content.split("\n"))
        else:
            full = os.path.join(base, path)
            if not os.path.isfile(full):
                return "error", f"file {path} not found"
            with open(full, encoding="utf-8", errors="replace") as f:
                n = sum(1 for _ in f)
        last = int(b or a or 0)
        if last > n:
            return "error", f"{path} has {n} lines; evidence points at line {last}"
        if a and not sha:
            return "warn", f"{path}:{a} is not pinned to a commit; lines may drift (use file:{path}:{a}@<sha>)"
        return "ok", ""

    if kind == "out":
        full = val if os.path.isabs(val) else os.path.join(base, val)
        if not os.path.isfile(full):
            return "error", f"output file {val} not found"
        return "ok", ""

    # pr / issue / url: external, checked for shape and optionally online.
    if kind == "url" and not re.match(r"^https?://\S+$", val):
        return "error", f"malformed url {val}"
    if kind in ("pr", "issue") and not re.match(r"^(#?\d+|https?://\S+)$", val):
        return "error", f"malformed {kind} reference {val}"
    if online and kind in ("pr", "issue") and shutil.which("gh"):
        num = re.sub(r"\D", "", val.rsplit("/", 1)[-1])
        r = subprocess.run(["gh", kind, "view", num, "--json", "number"], cwd=base, capture_output=True)
        if r.returncode != 0:
            return "error", f"{kind} {val} not found on the remote"
        return "ok", ""
    return "warn", f"{kind} {val} is external and was not opened (use --online to check PRs and issues)"


def out_exit_code(base, val):
    full = val if os.path.isabs(val) else os.path.join(base, val)
    try:
        with open(full, encoding="utf-8", errors="replace") as f:
            for line in f:
                if line.startswith("# exit: "):
                    return int(line.split(":", 1)[1])
                if not line.startswith("#"):
                    break
    except (OSError, ValueError):
        pass
    return None


PASS_WORDS = re.compile(r"\b(pass(es|ed|ing)?|green|succeed(s|ed)?|ok|all \d+ tests?)\b", re.I)
FAIL_WORDS = re.compile(r"\b(fail(s|ed|ing)?|red|error(s)?|broken)\b", re.I)


def result_mismatch(base, item, result):
    """Compare a row's result text with the exit code its captured output recorded."""
    kind, val = evidence_kind(item)
    if kind != "out":
        return "ok", ""
    code = out_exit_code(base, val)
    if code not in (None, 0) and PASS_WORDS.search(result) and not FAIL_WORDS.search(result):
        return "error", f"result says it passed, but {val} recorded exit {code}"
    if code == 0 and FAIL_WORDS.search(result) and not PASS_WORDS.search(result):
        return "warn", f"result says it failed, but {val} recorded exit 0"
    return "ok", ""


# ---------- commands ----------

def cmd_init(a):
    p = paths()
    os.makedirs(p["out"], exist_ok=True)
    state = load_state(p)
    _, rows = read_rows(p)
    if not rows and not os.path.exists(p["log"]):
        with open(p["log"], "w", encoding="utf-8") as f:
            f.write("\t".join(COLUMNS) + "\n")
        state["digests"] = []

    # Keep the log out of git without touching the repo's .gitignore.
    gitdir = git("rev-parse", "--git-common-dir")
    if gitdir:
        excl = os.path.join(gitdir if os.path.isabs(gitdir) else os.path.join(os.getcwd(), gitdir), "info", "exclude")
        os.makedirs(os.path.dirname(excl), exist_ok=True)
        existing = open(excl).read() if os.path.exists(excl) else ""
        if f"/{DIR_NAME}/" not in existing:
            with open(excl, "a") as f:
                f.write(("" if existing.endswith("\n") or not existing else "\n") + f"/{DIR_NAME}/\n")

    runs = []
    for r in rows:
        run = parse(r)[0]["run"]
        if run not in runs:
            runs.append(run)
    name = a.run or f"run-{len(runs) + 1}"
    if name in runs:
        sys.exit(f"Run {name!r} already exists in this log; pick a new name (each chat or session is its own run).")

    head = git("rev-parse", "HEAD")
    inherited = list(range(1, len(rows) + 1))
    result = (f"inherits rows {compress_ids(inherited)} from {', '.join(runs)} (not written by this run)"
              if inherited else "fresh log")
    state["run"] = name
    state["head_at_start"] = head
    append(p, state, [len(rows) + 1, now(), name, "start", "setup", f"start {name}", a.why or "",
                      f"commit:{head}" if head else "", result, compress_ids(inherited)])
    print(f"Run {name} started at row {len(rows) + 1}. Log: {os.path.relpath(p['log'])}")
    if inherited:
        print(f"Inherited {len(inherited)} rows from: {', '.join(runs)}. Read them with: worklog.py show")


def cmd_add(a):
    p = paths()
    need_log(p)
    state = load_state(p)
    if not state.get("run"):
        sys.exit("No current run. Start one with: worklog.py init --run <name>")
    if a.kind not in KINDS:
        sys.exit(f"Unknown kind {a.kind!r}. Use one of: {', '.join(KINDS)}")
    _, rows = read_rows(p)
    new_id = len(rows) + 1

    problems = []
    if a.kind in NEEDS_REF and not a.ref:
        problems.append(f"a {a.kind} row must name the row(s) it replaces with --ref")
    for i in expand_ids(a.ref):
        if not 1 <= i < new_id:
            problems.append(f"--ref {i} does not point at an earlier row")
    items = split_evidence(a.evidence)
    if not items:
        problems.append("--evidence is required (commit:, file:, out:, pr:, issue: or url:)")
    base = root()
    for item in items:
        for level, msg in (resolve(item, base), result_mismatch(base, item, a.result)):
            if level == "error":
                problems.append(msg)
            elif level == "warn":
                print(f"warning: {msg}", file=sys.stderr)
    if problems:
        sys.exit("Row not written:\n  - " + "\n  - ".join(problems))

    append(p, state, [new_id, now(), state["run"], a.kind, a.phase, a.decision, a.why,
                      " ; ".join(items), a.result, compress_ids(expand_ids(a.ref))])
    print(f"#{new_id} {a.kind}: {clean(a.decision)}")


def cmd_run(a):
    p = paths()
    os.makedirs(p["out"], exist_ok=True)
    cmd = a.cmd[1:] if a.cmd and a.cmd[0] == "--" else a.cmd
    if not cmd:
        sys.exit("Usage: worklog.py run [--label L] -- <command> [args...]")
    label = re.sub(r"[^A-Za-z0-9]+", "-", a.label or os.path.basename(cmd[0])).strip("-")[:40] or "cmd"
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = os.path.join(p["out"], f"{stamp}-{label}.txt")
    started = now()
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    body = proc.stdout.decode("utf-8", errors="replace")
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"# command: {' '.join(cmd)}\n# cwd: {os.getcwd()}\n# head: {git('rev-parse', 'HEAD') or '-'}\n"
                f"# dirty: {'yes' if git('status', '--porcelain') else 'no'}\n"
                f"# started: {started}\n# finished: {now()}\n# exit: {proc.returncode}\n\n{body}")
    sys.stdout.write(body[-4000:])
    rel = os.path.relpath(out, root())
    print(f"\n[worklog] exit {proc.returncode}; evidence: out:{rel}", file=sys.stderr)
    sys.exit(proc.returncode)


def analyse(p, online=False):
    """Everything check and show need: parsed rows plus findings."""
    header, lines = read_rows(p)
    state = load_state(p)
    base = root()
    rows, errors, warns = [], [], []

    if header != "\t".join(COLUMNS):
        errors.append(("-", "header row is missing or was changed"))

    digests = state.get("digests", [])
    for i, line in enumerate(lines):
        rid = i + 1
        if i < len(digests) and row_digest(line) != digests[i]:
            errors.append((rid, "row was edited after it was written (the log is append-only; add a correct row instead)"))
        elif i >= len(digests):
            errors.append((rid, "row was not written through worklog.py add"))
    if len(lines) < len(digests):
        errors.append(("-", f"{len(digests) - len(lines)} row(s) were deleted from the end of the log"))

    for i, line in enumerate(lines):
        rid = i + 1
        row, n = parse(line)
        rows.append(row)
        if n != len(COLUMNS):
            errors.append((rid, f"has {n} columns, expected {len(COLUMNS)}"))
            continue
        if row["id"] != str(rid):
            errors.append((rid, f"id says {row['id']!r}; rows are numbered by position"))
        if row["kind"] not in KINDS:
            errors.append((rid, f"unknown kind {row['kind']!r}"))
        try:
            dt.datetime.strptime(row["ts"], "%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            errors.append((rid, f"bad timestamp {row['ts']!r}"))
        try:
            refs = expand_ids(row["ref"])
        except ValueError:
            errors.append((rid, f"bad ref {row['ref']!r}"))
            refs = []
        if any(not 1 <= r < rid for r in refs):
            errors.append((rid, "ref points at a row that isn't earlier in the log"))
        if row["kind"] in NEEDS_REF and not refs:
            errors.append((rid, f"{row['kind']} row doesn't say which row it replaces"))
        items = split_evidence(row["evidence"])
        if not items and row["kind"] != "start":
            errors.append((rid, "no evidence"))
        for item in items:
            level, msg = resolve(item, base, online)
            if level == "error":
                errors.append((rid, msg))
            elif level == "warn":
                warns.append((rid, msg))
            level, msg = result_mismatch(base, item, row["result"])
            if level == "error":
                errors.append((rid, msg))
            elif level == "warn":
                warns.append((rid, msg))
        if row["kind"] in ("done", "fix") and not any(evidence_kind(e)[0] in ("out", "pr", "url") for e in items):
            warns.append((rid, f"{row['kind']} row has no test or run output (capture one with worklog.py run)"))

    # Which rows are still in force.
    replaced = {}
    for row in rows:
        if row.get("kind") in ("correct", "revert", "pivot"):
            for r in expand_ids(row["ref"]):
                replaced[r] = (row["kind"], row["id"])
    resolved = set()
    for row in rows:
        if row.get("kind") != "start":
            resolved.update(expand_ids(row["ref"]))
    blockers = [r for r in rows if r.get("kind") == "blocker" and int(r["id"]) not in resolved]

    # Commits made since each run started that no row mentions.
    # A start row's commit only marks where the run began; it doesn't explain anything.
    referenced = set()
    for row in rows:
        if row.get("kind") == "start":
            continue
        for item in split_evidence(row.get("evidence")):
            kind, val = evidence_kind(item)
            if kind == "commit":
                full = git("rev-parse", "--verify", "--quiet", f"{val}^{{commit}}", cwd=base)
                if full:
                    referenced.add(full)
            if kind == "file" and "@" in val:
                full = git("rev-parse", "--verify", "--quiet", val.rsplit("@", 1)[1] + "^{commit}", cwd=base)
                if full:
                    referenced.add(full)
    starts = [r for r in rows if r.get("kind") == "start"]
    first = next((evidence_kind(e)[1] for r in starts for e in split_evidence(r["evidence"])
                  if evidence_kind(e)[0] == "commit"), None)
    unlogged = []
    if first:
        listing = git("log", "--format=%H %s", f"{first}..HEAD", cwd=base) or ""
        for line in listing.splitlines():
            sha, _, subject = line.partition(" ")
            if sha not in referenced:
                unlogged.append((sha[:10], subject))
    for sha, subject in unlogged:
        warns.append(("-", f"commit {sha} \"{subject}\" has no row"))

    return {"rows": rows, "errors": errors, "warns": warns, "replaced": replaced,
            "blockers": blockers, "state": state, "unlogged": unlogged}


def cmd_check(a):
    p = paths()
    need_log(p)
    r = analyse(p, a.online)
    for rid, msg in r["errors"]:
        print(f"ERROR #{rid}: {msg}")
    for rid, msg in r["warns"]:
        print(f"WARN  #{rid}: {msg}")
    for b in r["blockers"]:
        print(f"OPEN  #{b['id']}: blocker \"{b['decision']}\" has no later row resolving it")
    print(f"\n{len(r['rows'])} rows, {len(r['errors'])} errors, {len(r['warns'])} warnings, "
          f"{len(r['blockers'])} open blockers")
    sys.exit(1 if r["errors"] else 0)


def md(text):
    return (text or "").replace("|", "\\|")


def cmd_show(a):
    p = paths()
    need_log(p)
    r = analyse(p)
    rows = r["rows"]
    runs = {}
    for row in rows:
        runs.setdefault(row["run"], []).append(int(row["id"]))
    counts = {}
    for row in rows:
        counts[row["kind"]] = counts.get(row["kind"], 0) + 1

    print("## Work log\n")
    print(", ".join(f"**{k}** {v}" for k, v in counts.items()))
    print("\n**Runs:** " + "; ".join(f"{name} (#{compress_ids(ids)})" for name, ids in runs.items()))
    print(f"\n**Check:** {len(r['errors'])} errors, {len(r['warns'])} warnings\n")

    print("| # | Run | Kind | Phase | Decision | Why | Result | Evidence |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for row in rows:
        rid = int(row["id"])
        if row["kind"] == "start" and not a.all:
            continue
        gone = r["replaced"].get(rid)
        if gone and not a.all:
            continue
        mark = f" ~~replaced by #{gone[1]}~~" if gone else ""
        print(f"| {rid} | {md(row['run'])} | {row['kind']} | {md(row['phase'])} | {md(row['decision'])}{mark} | "
              f"{md(row['why'])} | {md(row['result'])} | {md(row['evidence'])} |")

    if r["replaced"] and not a.all:
        print("\n**Replaced:** " + ", ".join(f"#{old} by #{new} ({kind})"
                                             for old, (kind, new) in sorted(r["replaced"].items())))
    if r["blockers"]:
        print("\n**Open blockers:**")
        for b in r["blockers"]:
            print(f"- #{b['id']} {b['decision']}: {b['why']}")
    if r["unlogged"]:
        print("\n**Commits with no row:** " + ", ".join(f"{s} {m}" for s, m in r["unlogged"]))


PACKET_PROMPT = """You are reviewing the decision log an AI coding agent kept while working unattended.
You did not do the work. Be skeptical. Look for:

1. Weak evidence: a row whose evidence doesn't actually show what the decision or result claims.
2. Skipped checks: work marked done with no test run, tests run on a dirty tree, a fix with no failing run before it.
3. Risky choices: deleted or disabled tests, widened permissions, swallowed errors, data migrations,
   force pushes, secrets, a dependency added for something small, a pivot with no stated reason.
4. Gaps: commits or changes in the diff summary that no row explains.

Reply with at most 8 concerns, most serious first, one line each, as:
  #<row or -> <concern> -- <what would settle it>
If nothing stands out, reply exactly: No flags.
"""


def cmd_packet(a):
    p = paths()
    need_log(p)
    r = analyse(p)
    base = root()
    print(PACKET_PROMPT)
    print("## Automated check\n")
    for rid, msg in r["errors"]:
        print(f"ERROR #{rid}: {msg}")
    for rid, msg in r["warns"]:
        print(f"WARN  #{rid}: {msg}")
    if not r["errors"] and not r["warns"]:
        print("clean")
    print("\n## Log (TSV)\n")
    with open(p["log"], encoding="utf-8") as f:
        print(f.read())
    first = r["state"].get("head_at_start")
    starts = [row for row in r["rows"] if row["kind"] == "start"]
    for row in starts:
        for e in split_evidence(row["evidence"]):
            if evidence_kind(e)[0] == "commit":
                first = evidence_kind(e)[1]
                break
        break
    if first:
        print(f"## Changes since the log began ({first[:10]}..working tree)\n")
        print(git("diff", "--stat", first, cwd=base) or "(none)")
    # Captured outputs that rows cite, trimmed.
    print("\n## Cited outputs (last 30 lines each)\n")
    seen = set()
    for row in r["rows"]:
        for e in split_evidence(row["evidence"]):
            kind, val = evidence_kind(e)
            if kind == "out" and val not in seen:
                seen.add(val)
                full = val if os.path.isabs(val) else os.path.join(base, val)
                try:
                    with open(full, encoding="utf-8", errors="replace") as f:
                        lines = f.read().splitlines()
                    head = [ln for ln in lines[:8] if ln.startswith("#")]
                    print(f"### {val} (row #{row['id']})\n" + "\n".join(head + ["..."] + lines[-30:]) + "\n")
                except OSError:
                    print(f"### {val}: missing\n")


def cmd_reviewers(a):
    p = paths()
    chosen = load_state(p).get("config", {}).get("reviewer")
    found = False
    for name, family, how in REVIEWER_CLIS:
        if shutil.which(name):
            found = True
            star = "  (configured)" if name == chosen else ""
            print(f"{name}\t{family}\t{how}{star}")
    if not found:
        print("none\tNo other-family reviewer CLI on PATH. Fall back to a fresh Claude subagent and say so.")


def cmd_config(a):
    p = paths()
    os.makedirs(p["dir"], exist_ok=True)
    state = load_state(p)
    cfg = state.setdefault("config", {})
    if a.setting:
        key, _, value = a.setting.partition("=")
        if value:
            cfg[key] = value
        else:
            cfg.pop(key, None)
        save_state(p, state)
    for k, v in cfg.items():
        print(f"{k}={v}")


def cmd_promote(a):
    p = paths()
    need_log(p)
    r = analyse(p)
    if r["errors"]:
        sys.exit("Fix the check errors before promoting (worklog.py check).")
    run = r["state"].get("run") or "log"
    dest = os.path.join(root(), "docs", "work-log", f"{dt.date.today().isoformat()}-{run}")
    os.makedirs(dest, exist_ok=True)
    shutil.copy2(p["log"], os.path.join(dest, "log.tsv"))
    cited = 0
    for row in r["rows"]:
        for e in split_evidence(row["evidence"]):
            kind, val = evidence_kind(e)
            if kind == "out":
                src = val if os.path.isabs(val) else os.path.join(root(), val)
                if os.path.isfile(src):
                    os.makedirs(os.path.join(dest, "out"), exist_ok=True)
                    shutil.copy2(src, os.path.join(dest, "out", os.path.basename(src)))
                    cited += 1
    print(f"Copied the log and {cited} cited output file(s) to {os.path.relpath(dest, root())}/. "
          f"out: paths in the copy still point at {DIR_NAME}/out/; the files sit beside it under out/.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init")
    s.add_argument("--run")
    s.add_argument("--why")
    s.set_defaults(fn=cmd_init)

    s = sub.add_parser("add")
    s.add_argument("--kind", required=True)
    s.add_argument("--phase", required=True)
    s.add_argument("--decision", required=True)
    s.add_argument("--why", required=True)
    s.add_argument("--evidence", default="")
    s.add_argument("--result", required=True)
    s.add_argument("--ref", default="")
    s.set_defaults(fn=cmd_add)

    s = sub.add_parser("run")
    s.add_argument("--label")
    s.add_argument("cmd", nargs=argparse.REMAINDER)
    s.set_defaults(fn=cmd_run)

    s = sub.add_parser("check")
    s.add_argument("--online", action="store_true")
    s.set_defaults(fn=cmd_check)

    s = sub.add_parser("show")
    s.add_argument("--all", action="store_true")
    s.set_defaults(fn=cmd_show)

    for name, fn in (("packet", cmd_packet), ("reviewers", cmd_reviewers), ("promote", cmd_promote)):
        sub.add_parser(name).set_defaults(fn=fn)

    s = sub.add_parser("config")
    s.add_argument("setting", nargs="?")
    s.set_defaults(fn=cmd_config)

    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
