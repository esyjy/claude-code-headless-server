# claude-code-headless-server — Session Context

> **If you're a fresh agent reading this for the first time (including
> after a post-compaction restart):** read this file end-to-end, then
> the [Playbook WORKFLOW](https://github.com/esyjy/playbook/blob/main/docs/WORKFLOW.md).
> Together they should let you pick up this project cold. If anything
> below contradicts what you observe in the repo, the document is wrong
> — fix it before you fix anything else.

> Last updated: 2026-06-15 by Step 6.5 release prep.
> **main HEAD**: pending merge of phase-6 (this commit).
> **Latest tag**: `v0.6.0` will land at the merge commit.
> **Next pickup**: post-merge — run `bash install.sh` on macbook + verify
> `lsof` shows 127.0.0.1 only. Phase 7 scope TBD (likely: unit test
> framework, see PROJECT-POLICY overrides).

---

## Pre-compaction snapshot

**Current state**

- **main HEAD**: `7e92b16` (upstream sync). Will become the phase-6 merge commit after Step 6.5.
- **Latest tag**: `v0.6.0` (this release).
- **Active branch**: `phase-6` → merging to `main`.
- **Tree state**: clean for release.

**Next pickup**

1. **Post-merge install test** — on the maintainer's macbook:
   `bash install.sh` (or `bash scripts/claude-headless-server.sh install`),
   then `claude-headless-server start`, then `lsof -nP -iTCP:4096
   -sTCP:LISTEN` must show **`127.0.0.1:4096` only** (no `*:4096`).
2. **Phase 7 planning** — see PROJECT-POLICY.md "Project-specific
   overrides" for the deferred-scope candidates (unit test framework
   most likely first).
3. **Upstream cleanup** — close `chyun-code/...#18` (mis-filed by this
   session before `gh repo set-default` was configured).

**Plan file**: `docs/plans/phase-6-playbook-adoption.md`.

**Tracking issue**: `esyjy/claude-code-headless-server#1`.

**Footguns in flight**

- Upstream issue `chyun-code/claude-code-headless-server#18` is a misfire
  (created against upstream by mistake before `gh repo set-default` was
  configured). It needs manual close by the maintainer.
- `gh` CLI default repo MUST be `esyjy/claude-code-headless-server`, not
  the upstream. Verify with `gh repo set-default`.

---

## TL;DR (the 30-second view)

- **What is this?** A programmable HTTP API for Claude Code with
  OpenCode/OpenTUI semantic compatibility. Bun + Hono. Each prompt is
  a fresh `claude -p` invocation; session continuity via `--resume`.
- **Current release:** none yet on this fork. Upstream is `v0.5.0`.
- **Currently in flight:** Phase 6 — playbook adoption + macbook
  hardening, targeting `v0.6.0`.
- **Next planned:** `v0.6.0` (this phase). Then `v0.7.0` is undecided.
- **How to verify locally:**
  ```bash
  bun install
  bun run tsc --noEmit          # typecheck
  bun run src/index.ts &        # start
  curl localhost:4096/api/health
  ```

---

## Current state

### Released

| Version | Date | Headline |
|---|---|---|
| v0.6.0 | 2026-06-15 | Playbook adoption + macbook hardening |

Upstream `chyun-code/claude-code-headless-server` shipped v0.1.0 →
v0.5.0 on 2026-06-14. ADRs 0001~0009 inherited.

### Active branch

- `main` — at v0.6.0.

### Step status (phase-6, closed)

| Step | Deliverable | Status |
|---|---|---|
| 6.1 | Opt-in scaffold + ADR 0010 | ✅ shipped |
| 6.2 | Bun.serve hostname pin + ADR 0011 | ✅ shipped |
| 6.3 | macOS tunnel.sh compat | ✅ shipped |
| 6.4 | Taskfile + CI + pre-push + labels | ✅ shipped |
| 6.5 | Merge + v0.6.0 tag + branch protection | 🚧 in-progress |

---

## Phase 6 active (kickoff 2026-06-15 — playbook adoption + macbook hardening)

- **Plan file**: `docs/plans/phase-6-playbook-adoption.md`.
- **Tracking issue**: #1.

### Locked user decisions

1. **Single-runtime exemption** (Bun only). Full rationale in plan.
2. **Single-OS CI exemption** (macOS-latest only). Target install
   surface is the user's macbook.

### ADRs shipped in v0.6.0

| ADR | Title | Status | Landed at |
|---|---|---|---|
| 0010 | Playbook v0.4.0 adoption + fork relationship | Accepted (2026-06-15) | Step 6.1 |
| 0011 | 127.0.0.1 default binding, opt-in external | Accepted (2026-06-15) | Step 6.2 |

### Out of scope for v0.6.0

- Unit test framework (Phase 7 seam — see PROJECT-POLICY overrides).
- Multi-runtime / multi-OS matrix (see PROJECT-POLICY overrides).
- OpenCode management UI (Phase 8+).
- Linux / Windows packaging (out of scope; PROJECT-POLICY overrides).

---

## Where to look on GitHub

- **Repo**: <https://github.com/esyjy/claude-code-headless-server>
- **Upstream**: <https://github.com/chyun-code/claude-code-headless-server>
  (experimental account; do NOT merge there directly).
- **Open issues**: `gh issue list --repo esyjy/claude-code-headless-server`.
- **Open PRs**: `gh pr list --repo esyjy/claude-code-headless-server`.

---

## How to revive / migrate this session

### Same machine, same Claude Code

```bash
cd ~/Documents/claude-code-headless-server
claude --resume "$(cat .claude-session-id 2>/dev/null)" || claude
```

### Different machine

Clone the fork, set the upstream remote, then continue:

```bash
gh repo clone esyjy/claude-code-headless-server
cd claude-code-headless-server
git remote add upstream https://github.com/chyun-code/claude-code-headless-server.git
```

---

## External state worth knowing

- **Maintainer's macbook** = primary install target (memory:
  macbook-as-server). M1 Air 8GB, long uptime, currently substituting
  for a dead-PSU main server.
- **No CI runs yet** — Step 6.4 introduces macOS-latest workflow.
- **No secrets** stored in this repo. OpenCode Basic Auth password is
  generated client-side at `~/.local/state/opencode/password` (ADR
  0009).

---

## Known footguns (the post-mortem aisle)

- **2026-06-15** — `gh issue create` defaulted to upstream
  (`chyun-code`) because `gh repo set-default` had not been configured
  yet. Created issue `chyun-code/...#18` by mistake. **Rule now**: after
  cloning a fork, immediately run `gh repo set-default <owner>/<repo>`
  before any `gh issue|pr` command.
- **Upstream `Bun.serve({port})` with no `hostname`** binds to
  `0.0.0.0` by default — LAN-exposable. Fixed in ADR 0011 + canary CI
  job (`bind-canary`). Any future `Bun.serve` usage in this repo must
  pin `hostname` explicitly or use the same env-fallback pattern.
- **Playbook `pre-push-hook.sh` uses `task --color=never`** which
  breaks on Task ≥ v3.42 (the flag became boolean). Local hook patched
  to `NO_COLOR=1 task --list`. **Upstream playbook needs the same
  fix** — file an issue on `esyjy/playbook` so the next
  `task hooks:install` doesn't reintroduce the bug.

---

## Sub-agent verification protocol

Spawn a fresh general-purpose agent and give it ONLY this file +
[Playbook WORKFLOW.md](https://github.com/esyjy/playbook/blob/main/docs/WORKFLOW.md).
Prompt:

```text
Read docs/SESSION-CONTEXT.md and the Playbook WORKFLOW.md, and NOTHING
ELSE. Then answer:

1. What version is currently shipped on this fork?
2. What's the next planned release and what does it deliver?
3. How do I run typecheck locally?
4. Why does Step 6.2 exist?
5. Where do I look on GitHub for the current state?

For each answer: cite the line(s) you derived it from. If you cannot
answer cleanly from those two files, list exactly what is missing.
```

If anything is missing, the document is wrong — fix it first.

---

## What's NOT durable elsewhere

- The user's "macbook 안전 실행" goal — captured in plan Goal §1, but
  reinforced here.
- The chyun-code → esyjy fork relationship — captured in ADR 0010.
- The accidental upstream-issue incident — captured in Footguns above.
