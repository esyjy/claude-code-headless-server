# ADR 0010 — Playbook v0.4.0 adoption + fork relationship

**Status:** Accepted (2026-06-15)

## Context

The upstream `chyun-code/claude-code-headless-server` was developed in an
experimental account driven by local models. v0.1.0 through v0.5.0
shipped in one day with rapid iteration on architecture (ADR 0001~0009)
but uneven discipline on the surrounding cadence: README version lag,
default branch left as `phase-1`, no LICENSE file, no CI, no branch
protection, and a default `0.0.0.0` bind in `Bun.serve`.

This fork (`esyjy/claude-code-headless-server`) was created to harden
the project for installation on the maintainer's macbook. The substance
of the upstream work (Hono routing, `--resume` session continuity,
OpenCode compatibility layer, ADR 0001~0009) is sound and is preserved
verbatim. What this fork adds is **operational discipline**: opt-in to
the [Playbook] methodology, durable handoff documents, a verification
surface, branch protection, and security-conscious defaults.

[Playbook]: https://github.com/esyjy/playbook

## Decision

### Sub-decision A — Opt in to Playbook v0.4.0

This repository declares Playbook v0.4.0 as its operational methodology
in `docs/PROJECT-POLICY.md`. The ten principles bind unless overridden
in the "Project-specific overrides" section with a documented reason.

### Sub-decision B — Maintain `esyjy` as the canonical fork

Future development happens on `esyjy/claude-code-headless-server`. The
upstream `chyun-code` repo is preserved as historical reference and
the experimental sandbox; no merges target it. The fork's `main` is the
ship target; `upstream/main` is read-only for sync.

### Sub-decision C — Inherit upstream ADRs 0001~0009 verbatim

ADRs 0001 through 0009 (Hono adoption, permission mapping, single-directory
deployment, SSH tunnel strategy, OpenTUI compatibility, OpenCode protocol
integration, OpenCode compatibility layer, OpenCode daemon registration,
Basic Auth) carry forward without re-litigation. New ADRs start at 0010
(this one).

### Sub-decision D — Record playbook deviations in PROJECT-POLICY.md

The "Project-specific overrides" section in `docs/PROJECT-POLICY.md`
records each deviation from playbook defaults with a one-line reason
and a trigger condition for revisiting. Initial overrides:

- Single-runtime (Bun only)
- Single-OS CI (macOS-latest only)
- No unit test framework yet (Phase 7 seam)

## Consequences

- **Internal seam**: `docs/PROJECT-POLICY.md` and `docs/SESSION-CONTEXT.md`
  are now load-bearing — they are read by future agents and contributors
  picking up cold. They must be kept in sync with the codebase.
- **User-facing surface change**: none directly. Indirectly, branch
  protection (Step 6.5) will block force-push to `main`.
- **CI / lint rule**: macOS-latest CI lane introduced in Step 6.4.
- **Trade-off accepted**: the playbook adds ceremony — issue-before-step,
  ADR-at-decision-time, session-context refresh. For a one-maintainer
  project the cost is real. Accepted because the upstream's chaotic
  shipping pattern is exactly the failure mode the playbook prevents.

## Alternatives considered

- **No playbook, ad-hoc cadence**: rejected. The upstream demonstrated
  what happens — README drifts four releases behind in one day, default
  branch left wrong, security default not pinned. The cost of recovery
  exceeds the cost of compliance.
- **Adopt playbook but keep upstream as the merge target**: rejected.
  The upstream is the experimental account; mixing disciplined and
  ad-hoc work in one history undermines both.
- **Defer playbook adoption to v0.7.0**: rejected. The point of the
  playbook is to catch drift early. Deferring it makes Step 6 itself
  ad-hoc, which is the failure mode being prevented.

## References

- [Playbook v0.4.0](https://github.com/esyjy/playbook/tree/v0.4.0)
- [Playbook PRINCIPLES.md](https://github.com/esyjy/playbook/blob/v0.4.0/docs/PRINCIPLES.md)
- ADR 0001 — Use Hono + Claude Code Headless (constrains the API shape)
- ADR 0003 — Single-Directory Deployment (constrains the install surface)
- `docs/PROJECT-POLICY.md` — the binding document
- `docs/plans/phase-6-playbook-adoption.md` — phase plan
- `docs/SESSION-CONTEXT.md` — handoff document
