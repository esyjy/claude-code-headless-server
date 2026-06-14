# Phase 7 Plan: Real OpenCode TUI integration + automode + `chs` CLI

**Branch:** `phase-7` (off main @ `e554158`)
**Target release:** `v0.7.0`
**Playbook version pinned:** `v0.4.0`

## Context

Phase 6 shipped `v0.6.0` with the macbook-safety goal met (127.0.0.1
default bind, CI canary, install path verified). But **the v0.5.0
upstream's central claim — "OpenTUI talks to our backend semantically"
— was never measured end-to-end.** A live probe during the v0.6.0
post-install verification turned up:

- `opencode attach http://localhost:4096 -u opencode -p ...` returns
  `Error: 404 Not Found`.
- The real opencode-attach protocol calls bare paths (`/global/event`,
  `/config`, `/agent`, `/provider`, `/config/providers`,
  `/experimental/console`, `/project/current`, `/path`), not the
  `/api/*` paths our `opencode-compat.ts` layer mounts.
- Even the routes we DO have (`/api/agent` etc.) are at the wrong
  prefix — opencode never reaches them.
- ADR 0006/0007/0008/0009 were authored on assumption, not measurement.
  The path/protocol mismatch makes them effectively non-functional.

Phase 7's goal is **to ship the OpenTUI integration the upstream
ADRs promised, but to do it from measurement rather than assumption.**

Adjacent scope the user pulled in:
- Short CLI alias `chs` (`chs tui`, `chs start`, ...) — current
  `claude-headless-server` is too long for daily use.
- Support Claude Code's **automode** (the harness behavioral mode used
  while authoring this plan) as a first-class `permissionMode` value
  alongside the four already in ADR 0002.

## Goal (반증 기준)

1. `chs tui` (or `claude-headless-server tui`) on user's macbook
   launches OpenTUI; OpenTUI sends a `"hello"` prompt; Claude Code
   responds; the streamed response renders in the TUI. End-to-end.
   No "TUI opens but stays dead" failures.
2. `PATCH /session/:id { "permissionMode": "auto" }` makes the next
   `claude -p` spawn enter automode. Verified by spawning a test
   prompt that would behave differently under default vs auto.
3. `chs tui` and `claude-headless-server tui` both work and are alias
   of each other. Neither breaks the other.
4. CI gains an E2E canary that fails if attach can't complete one
   prompt-response round trip. Replaces the soft "ADR 0007 says it
   works" claim with a runtime falsifiability check.
5. ADRs 0006–0009 carry **Superseded by ADR NNNN** status; the new
   ADRs are based on the measured protocol from Step 7.1.

## User Decisions Captured

- **Phase 6 overrides carry over** — single-runtime (Bun), single-OS CI
  (macOS), no unit test framework (Phase 8 seam).
- **`chs` as alias, not rename** — `claude-headless-server` keeps
  working. Both names valid.
- **Honest matrices over silent fixes** — Phase 7 must produce the
  ADR cleanup (7.7); we don't keep stale ADRs around the working
  layer.

## Step Plan

### Step 7.1 — Protocol probe + `docs/opencode-protocol.md`

**Issue:** new (tracking 7.1)
**Deliverable:**
- A captured trace of `opencode attach` against a real `opencode serve`
  instance with `--print-logs --log-level DEBUG`, recording every
  HTTP request (method, path, headers of interest, body) and response
  (status, body shape, content-type).
- A captured trace of opencode's SSE stream from `/global/event` (real
  event names, payload shapes, ordering).
- `docs/opencode-protocol.md` — the canonical map. Sections:
  - Discovery sequence (the first ~10 requests attach issues)
  - Session lifecycle (create, prompt, respond, end)
  - Event stream (full event taxonomy)
  - Auth surface (Basic Auth, header expectations)
  - Permission/question protocol (what attach expects for tool gating)
  - Gaps observed vs ADR 0007 stated layer

**Verify:** No section of the doc cites "assumption" or "TBD". Every
claim is anchored to a captured request/response.

**Commit:** `docs(protocol): map opencode attach protocol from live probe`

### Step 7.2 — Path scheme migration

**Issue:** new
**Deliverable:**
- Move opencode-compat routes from `/api/X` to `/X` (or remount as
  alias if internal usage of `/api/X` exists — TBD per probe).
- Add missing routes surfaced in 7.1: `/global/event`, `/path`,
  `/project/current`, `/experimental/console`, `/config/providers`,
  any others surfaced.
- Preserve our native `/api/*` for direct programmatic use; opencode
  layer is now a separate mount.

**Verify:**
- `curl -u opencode:$PW http://localhost:4096/<every-path-in-protocol-md>`
  returns 2xx with the documented shape.
- `opencode attach http://localhost:4096 -u opencode -p <PW>` no
  longer errors at discovery. (TUI may still not render correctly —
  that's 7.3's job — but no 404.)

**Commit:** `feat(routes): mount opencode-compat at root + add discovery endpoints`

### Step 7.3 — Event schema parity

**Issue:** new
**Deliverable:**
- `/global/event` SSE stream emitting events in the shape opencode
  parses (per 7.1 trace). Map our existing `session.next.*` taxonomy
  to opencode's taxonomy or replace it entirely.
- Update `src/routes/event.ts` (or replace) to match.
- `src/mapper/events.ts` updated.

**Verify:**
- `opencode attach ...` shows the TUI populated (sessions, agents,
  models pulled).
- Send a prompt via TUI → see streaming text render → see the prompt
  complete with cost/tokens displayed.

**Commit:** `feat(events): emit opencode-native SSE events on /global/event`

### Step 7.4 — `automode` permission

**Issue:** new
**Deliverable:**
- Investigate Claude Code CLI's automode entrypoint (claude --help,
  envs like `CLAUDE_AUTO_MODE`, behavioral docs). Add `"auto"` to
  `permissionMode` enum in `src/claude/runner.ts` and to the mapper.
- ADR 0002 (Permission mode semantic mapping) gets an addendum or a
  superseding ADR with the new row.
- README permission table updated.

**Verify:**
- `POST /session { permissionMode: "auto" }` then prompt → server logs
  show `claude` spawned with the automode flag.
- TUI permission-mode switcher includes "auto" (if opencode UI is
  extensible per 7.1) OR the mode is settable via API and the TUI
  reflects it.

**Commit:** `feat(permission): add automode mapping`

### Step 7.5 — `chs` CLI alias

**Issue:** new
**Deliverable:**
- `scripts/chs.sh` = thin wrapper that `exec`s
  `claude-headless-server` with the same arguments. (No logic
  duplication — both bound to the same script.) OR a symlink.
- `install.sh` and `scripts/claude-headless-server.sh install` also
  symlink `~/.local/bin/chs → wrapper`.
- `uninstall` removes both symlinks.
- README "Quick Install" section gains a "Short alias" note showing
  `chs tui`, `chs start`, etc.

**Verify:**
- `chs status`, `chs start`, `chs stop`, `chs tui` all dispatch
  through the same wrapper.
- `claude-headless-server` continues to work identically.
- After `chs uninstall`, neither `chs` nor `claude-headless-server`
  remains in `~/.local/bin/`.

**Commit:** `feat(cli): chs alias for claude-headless-server`

### Step 7.6 — E2E canary in CI

**Issue:** new
**Deliverable:**
- New CI job `e2e (macOS-latest)` that:
  1. Installs `opencode` (figure out reproducible install — likely
     `bun x opencode-ai` or per-repo prebuilt binary).
  2. Starts `chs start` in background.
  3. Runs `opencode run` (non-interactive prompt mode) pointed at our
     server with `OPENCODE_SERVER_URL` (or `attach + --prompt`).
  4. Asserts the response stream contains a non-empty assistant
     message.
- Job is the new acceptance gate for 7.x changes. Branch protection
  contexts updated.

**Verify:** push to phase-7 → CI runs `e2e` and it passes.

**Commit:** `ci(e2e): opencode attach → prompt → response acceptance gate`

### Step 7.7 — ADR cleanup

**Issue:** new
**Deliverable:**
- ADR 0012 — "OpenCode protocol surface (measured)", supersedes 0007
- ADR 0013 — "Bare-path mounting for opencode-compat", supersedes
  0006 prefix decision
- ADR 0014 — "automode permission mapping (extends 0002)"
- ADR 0015 — "Tabletop chs alias rationale" (only if non-trivial)
- ADR 0008 (daemon registration) → Superseded by ADR 0012; the
  `server.json` file is no longer load-bearing for attach.
- ADR 0009 (Basic Auth) — retained, but updated with the verified
  header path from 7.1 trace.

**Verify:** every superseded ADR has its Status line updated and
the new ADR's Context cites the predecessor.

**Commit:** `docs(adr): supersede 0006~0009 with measurement-based ADRs`

### Step 7.8 — Phase merge + v0.7.0 release

**Deliverable:**
- README v0.7.0 status (banner removed from phase-7 last commit).
- `main` no-ff merge, annotated tag `v0.7.0`.
- `gh release create v0.7.0` with release notes.
- About description updated.
- Branch protection: add `e2e (macOS-latest)` to required contexts.

**Verify (Phase acceptance):**
1. `chs tui` on user's macbook → TUI opens → send "hello" → Claude
   Code responds → text streams to TUI.
2. CI `e2e` green on the merge commit.
3. ADRs 0012~0015 Accepted; 0006~0009 marked Superseded where
   applicable.
4. Force-push to main still blocked.

## Key Decisions (ADR后)

- **ADR 0012** — Measured opencode protocol (supersedes 0007)
- **ADR 0013** — Bare-path mounting (supersedes 0006 prefix scheme)
- **ADR 0014** — automode permission (extends ADR 0002)
- **ADR 0015** — `chs` CLI alias (if needed)

## Non-goals + Seams

- **Unit test framework** — still Phase 8 seam per PROJECT-POLICY
  overrides. Step 7.6's E2E canary is the only new test infra.
- **OpenCode web UI** — out of scope. TUI only.
- **Multi-runtime** — single-runtime exemption retained.
- **Permission UI customization** — if opencode's permission-mode
  selector isn't extensible at the protocol level, we expose `auto`
  via API only and document it. Don't fork opencode.
- **Windows / Linux** — single-OS exemption retained.

## Critical Files (expected touch list)

- `src/index.ts` — route mounting reorg
- `src/routes/opencode-compat.ts` — full reshape per 7.1 measurement
- `src/routes/event.ts` + `src/mapper/events.ts` — schema parity
- `src/claude/runner.ts` — automode flag wiring
- `scripts/claude-headless-server.sh` — `tui` command becomes
  `opencode attach` based (replaces `exec opencode`)
- `scripts/chs.sh` (new) — alias wrapper
- `install.sh` — symlink both `claude-headless-server` and `chs`
- `.github/workflows/ci.yml` — new `e2e` job
- `docs/opencode-protocol.md` (new), `docs/adr/0012~0015` (new)
- ADR 0006~0009 — Status updates

## Risks

- **R1**: opencode protocol may include surfaces we can't faithfully
  replicate with `claude -p` (e.g. session-state queries, tool
  permissioning UX). For each such gap, Phase 7 must record an
  "Honest matrix" entry in PROJECT-POLICY (principle 3) rather than
  pretend support exists.
- **R2**: opencode binary version drift — protocol may change between
  1.17.x and a later release. Step 7.1 should record opencode
  version at probe time; CI's `e2e` job pins the version.
- **R3**: automode flag may not exist in Claude Code 2.1.x — could
  be a future-only mode. If so, 7.4 ships a documented seam with a
  trigger ("re-enable when CLI exposes `--auto`") and the API still
  accepts `"auto"` but logs that it falls back to `default` for now.
- **R4**: E2E canary may flake on CI runners due to network /
  resource limits when running opencode + chs + claude
  simultaneously. Mitigation: time-budget the canary; treat flakes
  as type:infra issues, not silent skips.

## Verification (Phase acceptance gate)

1. `chs tui` E2E demo on user's macbook (manual, recorded in
   SESSION-CONTEXT footguns if any quirks)
2. CI: `typecheck`, `bind-canary`, `e2e` all green
3. `docs/opencode-protocol.md` exists, no "TBD"s
4. ADR 0012~0015 Status: Accepted, 0006~0009 updated where
   applicable
5. `chs` and `claude-headless-server` both functional
6. `permissionMode: "auto"` round-trips through API

## Out of Scope (다음 phase 또는 그 이후로)

- Unit test framework (Phase 8 seam)
- Web UI (no plan)
- Multi-runtime / multi-OS matrix
- Custom OpenCode fork
- Session archive infrastructure (separate session-management repo)
- Hotfix for `package.json` version drift (header still shows
  `0.5.0` — track separately or roll into 7.5)
