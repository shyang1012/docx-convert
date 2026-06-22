# Agent Instructions — docx-convert

## Roles & Addressing

- **PL (Project Leader)** = Claude (이 프로젝트의 메인 에이전트, PM 지시 하 주 실행자)
- **PM (Project Manager)** = 승현님 (Seunghyeon Yang, 프로젝트 오너 / 전략·범위·배포 최종 승인자)
- **Codex** = audit 에이전트 (findings-first 리뷰, plan/code/risk 검증)
- **Gemini** = strategic architect (Why & Better Way, 장기 구조)

이 프로젝트는 이슈 추적에 **bd (beads)** 를 쓴다. `bd onboard` 로 시작.

**메모리**: 메모리 인덱스는 `.claude/memory/MEMORY.md` (in-repo 평문, git 추적 → 머신·에이전트 독립). 지식·결정 본문은 bd (`bd remember`/`bd recall`) 가 주력. 세션 시작 시 `CLAUDE.md` 포인터 또는 `/시작` 이 이 인덱스를 읽는다. 홈 경로 자동 메모리에는 이 파일을 가리키는 포인터만 둔다.

**호칭 규칙**:
- PM 은 한국어 대화에서 **승현님**, 운영 노트에선 **PM**
- 코드 커밋·git author 는 **shyang**
- 노트의 "PL" 은 Claude 메인 에이전트를 의미

## Team & Delegation (모델 할당)

**나(Claude)의 역할: PL + 풀스택 라이브러리 개발자.** 아키텍처·변환 로직 방향·리뷰 최종 승인은 PL 직접. 구현/테스트/문서는 서브에이전트로 위임.

| 역할(서브에이전트) | 담당 | 위임 기준 | 모델 |
|------|------|----------|------|
| 라이브러리 개발자 | 변환기(render/xml-builder/vdom/utils) 구현 | 구현 태스크, 버그 수정 | sonnet (단순 haiku) |
| 테스트 엔지니어 | vitest 단위·통합, 회귀/정합성 | 테스트 작성/갱신, 회귀 검증 | sonnet (단순 haiku) |
| 테크라이터 | README·CLAUDE·AGENTS·CHANGELOG, 출처(LICENSE/NOTICE) 정합 | 문서 구조화, 출처 정합 유지 | sonnet |
| OOXML 전문가 | OOXML 스펙 대조, Word 열림 검증 | 포맷 정합, 호환 진단 | sonnet |

**모델 할당 정책**:
- **PL(나) = opus** (사용자 세션이 sonnet 이면 PL 도 sonnet)
- **팀원(서브에이전트) = sonnet** 기본. 아래 3조건 **모두** 충족 시 haiku: ① 단일 파일 수정/탐색 ② 아키텍처 판단 불필요 ③ 명확한 입출력(포맷 변환·단순 검색·lint).
- Agent 호출 시 `model` 파라미터를 **반드시 명시**.

## What is docx-convert

HTML 문자열을 `.docx`(Office Open XML)로 변환하는 순수 JavaScript 라이브러리 (headless 브라우저·LibreOffice·네이티브 바이너리 불필요). 출력은 `Buffer`(Node) 또는 `Blob`(브라우저).

- [@turbodocx/html-to-docx](https://github.com/TurboDocx/html-to-docx)(MIT) fork·확장. 원작은 [privateOmega/html-to-docx](https://github.com/privateOmega/html-to-docx)(MIT). 출처: `LICENSE` / `NOTICE`.
- 아키텍처 상세: `CLAUDE.md`(로컬).
- 차별화 방향: 인라인 스타일 충실도, flex/grid `<div>` 레이아웃의 표 매핑.

## 빌드 / 테스트

```bash
npm install
npm run build      # esbuild → dist/ (ESM + CJS + browser ESM)
npm run test:unit  # vitest run
npm run lint       # eslint --fix
```

- **git hooks 활성화(clone 후 1회)**: `npm run prepare`(= `git config core.hooksPath .githooks`). `.npmrc` `ignore-scripts=true` 라 자동 실행 안 됨. 훅은 `.githooks`(husky 대신 네이티브) 마스터 — pre-commit=lint-staged + beads 위임, commit-msg=commitlint, 나머지=beads 위임. ⚠️ `bd hooks install` 재실행 시 `core.hooksPath` 가 `.beads/hooks` 로 되돌아갈 수 있으니 그때 `npm run prepare` 재실행.
- 줄바꿈은 `.gitattributes`(`eol=lf`)로 LF 고정 — Windows 워킹트리가 CRLF여도 git/prettier 는 LF.
- 소스는 현재 JS. esbuild 는 `.ts` 네이티브 지원 → 추후 TypeScript 점진 전환 시 빌드 변경 불필요.
- `sharp` 는 SVG→PNG 래스터화에만 쓰이는 optional 네이티브 의존성. 브라우저 빌드는 null stub.
- 코어는 브라우저 안전을 유지 — Node 전용 API 추가 시 빌드 영향 확인.

## bd Quick Reference

```bash
bd ready                # 가능한 작업 찾기
bd show <id>            # 이슈 상세
bd update <id> --claim  # 작업 점유
bd close <id>           # 완료
bd note <id> "..."      # 진행 노트(핸드오프 로그)
bd create --type <type> --title "..."
```

### bd Issue Types

| Type | 용도 |
|------|------|
| `task` | 단발 실행(빌드/변환/튜닝 등) |
| `bug` | 결함/회귀 수정 |
| `feature` | 신규 기능(새 변환 경로·옵션·스타일 충실도·레이아웃 매핑) |
| `chore` | 문서/CI/의존성/정리 |
| `epic` | 다중 이슈 묶음(레이아웃 매핑 등 대형 작업) |
| `decision` | 지속 정책/ADR(네이밍·라이선스·운영 규칙) |

- 비단순 이슈 생성 시 `--type` 명시. `decision` 은 정책 유효한 동안 OPEN 유지.
- **이슈 추적은 `bd` 로** — TodoWrite/마크다운 TODO 대신.

## Project Operating Policy

개인 프로젝트 + local-first 워크플로우.

- GitHub: `shyang1012/docx-convert` (public).
- 로컬 git = 최종 코드 원장, 로컬 `.beads` = 최종 이슈 원장.
- **`dev` = 일상 개발·백업 브랜치.** 평소 모든 작업·커밋은 `dev` 에서.
- **`main` = 배포 브랜치.** `dev`→`main` 은 **배포를 결정했을 때만** 머지.
- git push 는 명시 배포 요청이 없으면 **`origin/dev`** 로만.
- upstream(TurboDocx) 변경은 별도 보존 클론(`html-to-docx`)에서 받아 수동 이식.

## 배포 워크플로우

**개발은 `dev`, 배포 결정 시 `main` 에 검증 + PR.** `main` 은 GitHub branch protection 으로 **직접 push 차단**(PR 필수) — 배포는 반드시 PR 경유.

1. **개발** — `dev` 브랜치에서 구현. TDD(테스트 먼저), 커밋, `git push origin dev`.
2. **배포 결정** — PM 이 배포를 결정하면:
   1. **전체 검증** — `npm run build && npm run test:unit` 통과 + 대표 HTML 변환 산출물 Word 열림 확인(가능 시).
   2. **버전 bump(dev) + PR** — `npm version <patch|minor|major> --no-git-tag-version` 로 dev 에서 버전만 올려 커밋(`main` 직접 push 불가하므로 bump 커밋을 PR 에 실음) → `dev` → `main` PR. 변경 요약·검증 결과 기재.
   3. **머지 후 배포** — 머지 후 `main` 에서 **태그만** push(`git tag v* && git push origin v*`, 태그는 보호 대상 아님). v 태그 push → `.github/workflows/publish.yml`(**OIDC Trusted Publisher**)이 토큰 없이 `npm publish --provenance` 자동 수행. 배포 승인 = 태그 push 시점(PM 결정). `.npmrc` `ignore-scripts=true` 라 워크플로우가 빌드·테스트를 명시 step 으로 실행.

## 코드 서명

- 본인 신규/대폭 수정 파일 헤더 주석에 `[shyang YYYY-MM-DD]`.
- docx-convert 는 외부 코드 포팅이 없으므로 "원작:" 헤더 주석은 불필요(출처는 LICENSE/NOTICE).

## 보안 / 시크릿

- `.npmrc`(공급망 하드닝: min-release-age / ignore-scripts / save-exact 적용)·`.env`·키 파일은 커밋·노출 금지.
- npm 배포는 **OIDC Trusted Publisher**(GitHub Actions, 토큰리스·provenance) — 평시 npm 토큰 불필요. fallback 수동 publish 시에만 만료형(Granular/Automation) 토큰 사용.

## 금지 / 확인 (모든 모드)

- 🔴 자발 금지: `git push --force` / `git reset --hard` / 브랜치·태그 삭제 / `main` 직접 push(배포 외). — `main` 은 GitHub branch protection 으로 서버 차원 강제: PR 필수·enforce_admins(관리자 포함)·force-push/삭제 차단.
- ⚠️ 실행 전 PM 확인: `npm publish`, PR 생성/머지, 공개 배포, 의존성 downgrade, CI 변경.

## Non-Interactive Shell

`cp`/`mv`/`rm` 등은 비대화형 플래그로(`-f`, `-rf`) — 확인 프롬프트 대기 방지.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` for full workflow context.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite/TaskCreate/markdown TODO.
- Use `bd remember` as the **primary** store for persistent knowledge and decisions.
- `MEMORY.md` is a thin **index/pointer** only — the harness auto-injects it at session start, so it points to `bd prime` and holds a few long-lived operating rules (keep it short). Detail lives in bd.
- Run `bd prime` (or `/시작`) at session start to load memories + ready issues.

## Session Completion

작업 세션 종료 시 local-first 체크리스트. GitHub push 는 옵션(요청 시 `origin/dev`).

1. **남은 작업 이슈화** — `bd create`
2. **품질 게이트**(코드 변경 시) — `npm run test:unit` / `npm run build`
3. **이슈 상태 갱신** — 완료 close, 진행 업데이트
4. **로컬 커밋** — `git add` → `git commit`
5. **옵션 백업** — `git push origin dev` (작업 브랜치만)
6. **정리·핸드오프** — 다음 세션 컨텍스트 제공

**CRITICAL**:
- 명시 요청 없이 `bd dolt push` 금지.
- 명시 배포 요청 없이 `main` push/머지 금지.
- 명시 요청 없이 force-push / 브랜치 rewrite 금지.
- 무관한 로컬 변경 보존.
<!-- END BEADS INTEGRATION -->
