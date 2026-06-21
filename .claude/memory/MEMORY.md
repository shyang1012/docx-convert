# Memory Index — docx-convert

이 프로젝트는 **bd (beads)** 가 지식·결정·이슈의 주력 저장소다.
이 파일(`.claude/memory/MEMORY.md`)은 **얇은 index/포인터**일 뿐 — 본문은 bd 에 있다.

머신·에이전트 독립을 위해 이 인덱스를 프로젝트 안 평문으로 둔다(git 추적).
홈 경로(`~/.claude/projects/.../memory/MEMORY.md`)에는 이 파일을 가리키는 포인터만 남기고,
프로젝트 `CLAUDE.md` 가 세션마다 이 파일을 읽도록 자동 주입한다.

세션 시작 시 아래를 실행해 컨텍스트를 로드할 것:

- `bd prime` — persistent memories + ready 이슈 주입 (또는 `/시작` 커맨드)
- `bd memories <키워드>` — 검색 / `bd remember "<insight>" --key <key>` — 기록 / `bd forget <key>` — 제거

## 장기 운영규칙 (변하지 않는 것만, 짧게 유지)

- **출처**: @turbodocx/html-to-docx (MIT, orig privateOmega) fork. LICENSE/NOTICE 보존. → `bd recall fork-origin`
- **차별화는 여기서**: 인라인 스타일 충실도 + flex/grid `<div>`→표 매핑. 범용 버그수정만 upstream PR. → `bd recall fork-origin`
- **브랜치**: `dev`=개발 / `main`=배포. push 옵션(요청 시 `origin/dev`), `bd dolt push`·main push·force-push 는 명시 요청 시만.
- **툴체인**: esbuild 빌드 / vitest 테스트 / eslint. 소스 JS, TS 전환 점진. → `bd recall toolchain`
- git author = `shyang`. 코드 서명 `[shyang YYYY-MM-DD]`.
