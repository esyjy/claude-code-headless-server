# Phase 6 Plan: Playbook Adoption + Hardening

**Branch:** `phase-6` (off main)
**Target release:** `v0.6.0`
**Playbook version pinned:** `v0.4.0`

## Context

`esyjy/claude-code-headless-server`는 `chyun-code/claude-code-headless-server`의 포크.
원본은 실험용 계정에서 로컬 모델로 v0.1.0 → v0.5.0까지 빠르게 만들어진 상태고,
설계 의도(ADR 0001~0009)는 살아있으나 다음 운영 기준 항목이 빠짐:

- Playbook opt-in 선언 없음
- `SESSION-CONTEXT.md`, `LICENSE`, CI, branch protection, pre-push hook 없음
- `Bun.serve`에 hostname 미지정 → 기본 `0.0.0.0` (LAN 노출)
- `scripts/tunnel.sh`의 `readlink -f`는 BSD readlink(macOS)에서 실패

Phase 6의 목표는 **이 포크를 user의 맥북에서 안전하게 실행 가능한 v0.6.0으로 끌어올리는 것.**

## Goal (반증 기준)

1. `v0.6.0` 머지 후 user 맥북에서 `claude-headless-server start` 실행 시
   기본값으로 `127.0.0.1`만 바인딩 — `lsof -nP -iTCP:4096`에 `*:4096` 미노출.
2. `bash scripts/tunnel.sh status` 가 macOS에서 에러 없이 실행됨.
3. main 브랜치에 force-push / 삭제 시도가 차단됨 (`enforce_admins: true`).
4. CI: macOS-latest에서 typecheck + 통합 테스트 green.
5. `docs/PROJECT-POLICY.md` 가 Playbook v0.4.0 opt-in을 선언하고
   "Project-specific overrides"에 single-runtime / single-OS 면제 기록.

## User Decisions Captured

- **Single-runtime 면제** — Bun 단일 런타임. Node/Deno 매트릭스 안 굴림.
- **Multi-OS CI 면제** — macOS-latest만 (사용 타겟이 user 맥북).
- **나머지는 plan 원안대로**.

## Step Plan

### Step 6.1 — Playbook opt-in scaffold

**Issue:** new (file before commit)
**Deliverable:**
- `docs/PROJECT-POLICY.md` (Playbook v0.4.0 선언 + overrides에 single-runtime/single-OS 면제 명기)
- `docs/SESSION-CONTEXT.md` (TL;DR / Where to look / Footguns)
- `LICENSE` (MIT)
- `.gitignore`에 `.claude-session-id` 추가
- `docs/adr/0010-playbook-v0.4.0-adoption.md` (포크 관계, 면제 내역, 트리거 조건)

**Verify:** `bash ~/Documents/playbook/skills/playbook.md` 체크리스트의 §1 4개 항목 ✓

**Commit:** `chore(docs): adopt playbook v0.4.0 + scaffold opt-in artifacts`

### Step 6.2 — Default hostname pin + security ADR

**Issue:** new + #16 트리아지
**Deliverable:**
- `src/index.ts`: `Bun.serve({ port, hostname: ... })` — 기본 `127.0.0.1`,
  `CLAUDE_SERVER_HOST` 환경변수로 외부 노출 명시적 opt-in
- `docs/adr/0011-localhost-default-binding.md` (default-secure, opt-in 노출)
- README "Quick Install" 섹션에 외부 노출 절차 별도 명기
- Issue #16 라벨링 + 상태 확인

**Verify:**
- `PORT=14096 bun run src/index.ts &` 후 `lsof -nP -iTCP:14096 -sTCP:LISTEN`이
  `127.0.0.1:14096` 만 보여야 함 (`*:14096` 아니어야 함)
- 명시적 `CLAUDE_SERVER_HOST=0.0.0.0` 설정 시 `*:14096` 노출

**Commit:** `fix(security): bind to 127.0.0.1 by default, opt-in external via env`

### Step 6.3 — macOS tunnel.sh compat

**Issue:** new
**Deliverable:**
- `scripts/tunnel.sh:14`의 `readlink -f` → POSIX-safe 경로 해석
  (BSD readlink fallback 또는 `cd ... && pwd` 패턴)

**Verify:** macOS에서 `bash scripts/tunnel.sh status` 가 에러 없이 실행 (config 없을 때도 의도된 메시지)

**Commit:** `fix(scripts): tunnel.sh POSIX-safe path resolution (macOS compat)`

### Step 6.4 — Verification surface

**Issue:** new
**Deliverable:**
- `Taskfile.yaml` (playbook node 베이스 + 프로젝트 특화 task)
- `.github/workflows/ci.yml` (macOS-latest 만, Bun setup, typecheck + integration test)
- `.git/hooks/pre-push` 설치 (playbook 템플릿)
- 라벨 분류: `type:bug`, `type:feature`, `type:refactor`, `type:infra`,
  `area:server`, `area:scripts`, `area:docs`, `priority:p0/p1/p2`

**Verify:** push 시 pre-push hook가 typecheck 실행. CI 첫 run green.

**Commit:** `ci(infra): macOS CI, Taskfile, pre-push hook, issue labels`

### Step 6.5 — Phase merge + v0.6.0 release

**Deliverable:**
- README v0.6.0 status line 갱신, hostname 변경 사항 명기
- `main`에 `--no-ff` 머지
- annotated tag `v0.6.0`
- `gh release create v0.6.0`
- `gh repo edit --description "..."`
- `gh api PUT /repos/esyjy/claude-code-headless-server/branches/main/protection`

**Verify:**
- `git push --force origin main`이 차단됨
- About 디스크립션이 v0.6.0 status 반영
- user 맥북에서 `bash install.sh`로 설치 → `start` → `lsof`로 127.0.0.1 확인

## Key Decisions (ADR 후보)

- **ADR 0010** — Playbook v0.4.0 채택, 포크 관계, 면제 내역
- **ADR 0011** — `127.0.0.1` 기본 바인딩, 외부 노출은 `CLAUDE_SERVER_HOST` 옵트인
- (필요시) **ADR 0012** — Single-OS / single-runtime CI 면제 근거

## Non-goals + Seams

- **Unit test 인프라 도입** — Phase 7 seam. 현재는 integration test 한 개만.
  `Taskfile.yaml`에 `test:unit:` 태스크 자리는 잡되 본문은 `echo "Phase 7 seam"` 처리.
- **OpenCode 대시보드/관리 UI** — Phase 8+ seam.
- **Windows / Linux 패키징** — Out of scope. PROJECT-POLICY overrides 명기.

## Critical Files

- `src/index.ts` — Bun.serve 바인딩
- `scripts/claude-headless-server.sh` — wrapper
- `scripts/tunnel.sh` — macOS 호환 픽스
- `docs/PROJECT-POLICY.md`, `docs/SESSION-CONTEXT.md`, `docs/adr/0010~0011` — opt-in 표면

## Risks

- **R1**: `hostname` 옵션이 Bun의 일부 버전에서 동작 안 할 수 있음. 검증 시 명시적으로 `lsof` 확인.
- **R2**: macOS GitHub Actions runner가 Bun 캐시 미흡 → CI 시간 증가. 영향 적음.
- **R3**: pre-push hook가 typecheck 통과 못 하면 push 차단 → 진행 막힘. 진단 메시지 보강.

## Verification (Phase acceptance gate)

머지 직전 다음 모두 통과해야 함:
1. `bun run tsc --noEmit` clean
2. macOS CI green (push → workflow → ✓)
3. `lsof` 검증 (Step 6.2)
4. `bash scripts/tunnel.sh status` 깨끗하게 실행 (Step 6.3)
5. ADR 0010, 0011 Status: Accepted
6. SESSION-CONTEXT.md `Last updated:` 갱신
7. README v0.6.0 status line

## Out of Scope (다음 phase로)

- Unit test suite (Phase 7)
- Multi-runtime / multi-OS 매트릭스
- OpenCode UI 관리 표면
- Windows / Linux 패키징
- Session archive 인프라 (별도 session-management 리포)
