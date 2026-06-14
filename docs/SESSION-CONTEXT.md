# claude-code-headless-server — Session Context

> **If you're a fresh agent reading this for the first time (including
> after a post-compaction restart):** read this file end-to-end, then
> the [Playbook WORKFLOW](https://github.com/esyjy/playbook/blob/main/docs/WORKFLOW.md).
> Together they should let you pick up this project cold. If anything
> below contradicts what you observe in the repo, the document is wrong
> — fix it before you fix anything else.

> Last updated: 2026-06-15 by phase-7 kickoff.
> **main HEAD**: `e554158` `Merge phase-6: v0.6.0 — Playbook v0.4.0 adoption + macbook hardening`.
> **Latest tag**: `v0.6.0` (2026-06-15).
> **Active branch**: `phase-7` — OpenCode TUI integration (real this time).
> **Next pickup**: Step 7.1 — protocol probe (capture opencode attach
> traffic, write `docs/opencode-protocol.md`). See plan
> [`docs/plans/phase-7-opencode-tui-integration.md`](plans/phase-7-opencode-tui-integration.md).

---

## Pre-compaction snapshot

**Current state**

- **main HEAD**: `7e92b16` (upstream sync). Will become the phase-6 merge commit after Step 6.5.
- **Latest tag**: `v0.6.0` (this release).
- **Active branch**: `phase-6` → merging to `main`.
- **Tree state**: clean for release.

**Next pickup**

1. **Step 7.1 — protocol probe**. Capture `opencode attach` traffic
   against real `opencode serve` (with `--print-logs --log-level
   DEBUG`). Document every path × method × payload × response in
   `docs/opencode-protocol.md`. No assumption — only measurement.
2. **Step 7.2 — path scheme migration** (depends on 7.1).
3. **Step 7.3 — event schema parity** (depends on 7.1).
4. **Phase 6 closeout — upstream**: close `chyun-code/...#18`
   (mis-filed during fork bootstrap).

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

- `phase-7` — OpenCode TUI integration. Plan:
  [`docs/plans/phase-7-opencode-tui-integration.md`](plans/phase-7-opencode-tui-integration.md).

### Step status (phase-6, closed; phase-7, kickoff)

| Phase | Step | Deliverable | Status |
|---|---|---|---|
| 6 | all | v0.6.0 hardening | ✅ shipped 2026-06-15 |
| 7 | 7.1 | Protocol probe + docs/opencode-protocol.md | 🚧 in-progress |
| 7 | 7.2 | Path scheme migration | pending |
| 7 | 7.3 | Event schema parity | pending |
| 7 | 7.4 | automode permission | pending |
| 7 | 7.5 | `chs` CLI alias | pending |
| 7 | 7.6 | E2E canary in CI | pending |
| 7 | 7.7 | ADR cleanup | pending |
| 7 | 7.8 | Merge + v0.7.0 tag | pending |

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
- **2026-06-15 — opencode-compat layer is at the wrong path prefix.**
  Live probe (during v0.6.0 verification) showed `opencode attach`
  hits bare paths (`/global/event`, `/config`, `/agent`, `/provider`,
  `/config/providers`, `/experimental/console`, `/project/current`,
  `/path`), but our routes are at `/api/*`. ADR 0007 (and the daemon
  registration claim in ADR 0008) were authored from assumption, not
  measurement, and never worked end-to-end. v0.6.0's macbook-safety
  goal is intact — but the "TUI uses our backend" claim was always
  false. Phase 7 fixes this from the protocol up; ADRs 0006~0009
  will be superseded in Step 7.7.
- **`/api/health` response still says `version: 0.5.0`** even on the
  installed v0.6.0 build. `src/routes/health.ts` hard-codes or reads
  a stale `package.json`. Track separately (Phase 7 surface or
  hotfix candidate).

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
