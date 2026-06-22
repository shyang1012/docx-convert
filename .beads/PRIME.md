# docx-convert — Session Prime

> 이 prime 은 **가볍게** 유지한다. 메모리 본문을 여기 싣지 않는다 —
> 인덱스(`bd memories`)만 보고, 필요한 것만 `bd recall <key>` 로 펼친다.

## 세션 로드 순서 (/시작 이 실행)

1. `bd memories` — **메모리 인덱스**(키 + 한 줄 요약). 본문은 `bd recall <key>`.
2. **최근 세션 맥락 3회** — 인덱스의 `session-*` 중 최근 3개만 `bd recall`. 나머지 세션은 펼치지 않음(필요 시 키로 recall).
3. `bd ready` — 착수 가능 이슈.

## 핵심 규칙 (상세는 AGENTS.md / `bd recall`)

- 이슈·지식 추적은 **bd**. TodoWrite/TaskCreate/markdown TODO 금지.
- 브랜치: `dev`=개발 / `main`=배포. push 옵션(요청 시 `origin/dev`). `bd dolt push`·`main` push·force-push 는 **명시 요청 시만**.
- 메모리 정책: `bd recall memory-policy`. 출처/차별화: `bd recall fork-origin`. 툴체인: `bd recall toolchain`.

## 세션 종료 (/종료)

- 이번 세션 요약을 `bd remember --key session-YYYY-MM-DD "<완료/결정/다음>"` 로 1건 기록(누적되면 오래된 session-* 은 `bd forget`).
- 코드 변경 시 `npm run test:unit` / `npm run build`, 로컬 커밋. push 는 옵션.
