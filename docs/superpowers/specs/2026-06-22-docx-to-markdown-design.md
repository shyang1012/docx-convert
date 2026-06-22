# Design — docx → markdown (1차)

- Status: approved (brainstorming) · 2026-06-22
- Author: shyang (PM) / PL(Claude)
- bd: (착수 시 feature 이슈 생성)

## 배경 / 목표

`docx-convert` 는 현재 **HTML → docx 단방향**(`generateContainer` default export)뿐이다. 이름 그대로 "convert" 모듈인 만큼, 자매 프로젝트 `hwp-convert`(HWPX 중심 양방향 변환 매트릭스: `extractText/extractHtml/extractMarkdown`, `hwpToMarkdown`, `markdownToHwpx` …)와 **동등한 다방향 변환 라이브러리**로 키운다. 그 첫 역변환이 **docx → markdown**.

이번 1차는 markdown 출력에 집중하되, **포맷 중립 IR(중간표현)** 을 한 번 만들어 추후 `docx → text/html` serializer 를 같은 IR 위에 얹을 수 있게 한다.

## 결정 사항 (확정)

1. **공개 API**: 기존 `default export generateContainer` 유지 + **named export** 추가.
   - 주 이름 **`docxToMarkdown(input, options?)`** — 방향이 이름에 드러나 범용·직관적, 매트릭스 확장(`markdownToDocx`, `docxToHtml` …)과 패턴 일관.
   - 별칭 **`extractMarkdown`** — hwp-convert 자매 정합용 얇은 re-export(한 줄). 문서·예제는 `docxToMarkdown` 우선, 별칭은 "자매 정합"으로 명시.
   - 입력: `Buffer`(Node) / `ArrayBuffer`·`Blob`·`Uint8Array`(browser). 출력: `Promise<string>`.
2. **파싱 전략**: 자체 파서 — 이미 의존성인 **JSZip** 으로 zip 해제 + **htmlparser2(`xmlMode:true`)** 로 `document.xml` 등 파싱. **새 의존성 0**(순수 JS·브라우저 안전·네이티브 의존 없음 = docx-convert 정체성 유지). 네임스페이스(`w:p`)·self-closing 처리는 구현 첫 단계에서 PoC 로 확인, 걸리면 `sax` 류 경량 파서 폴백.
3. **충실도(1차)**: 핵심 구조 풀셋, 이미지는 placeholder.

## 아키텍처

```
docx(zip)
  ──JSZip──▶ word/document.xml (+ numbering.xml, styles.xml, word/_rels/document.xml.rels)
  ──htmlparser2(xmlMode)──▶ DOM-ish nodes
  ──reader/build-ir──▶ IR (블록 트리)
  ──serializers/markdown──▶ markdown string
```

### 모듈 (단일 책임)
- `src/reader/docx-reader.js` — 입력 정규화(Buffer/ArrayBuffer/Blob) → JSZip 로드 → 필요한 파트 추출. "어떤 zip 파트가 있나"만 안다.
- `src/reader/ooxml-parse.js` — XML 문자열 → 파싱 트리(htmlparser2 래핑). 파서 교체 가능 지점.
- `src/reader/build-ir.js` — 파싱 트리 + numbering/styles → **IR**. OOXML 의미(pStyle=Heading, numbering 레벨, run 속성)를 IR 로 환원.
- `src/serializers/markdown.js` — IR → markdown. 출력 포맷 지식은 여기만.
- `index.js` — `docxToMarkdown`/`extractMarkdown` named export 배선.

### IR (포맷 중립)
```
Block =
  | { type:'heading', level:1..6, children:Inline[] }
  | { type:'paragraph', children:Inline[] }
  | { type:'list', ordered:boolean, items:ListItem[] }
  | { type:'table', rows:Inline[][][] }      // rows[r][c] = cell inlines
ListItem = { children:Inline[], sublist?:Block(list) }
Inline =
  | { text:string, bold?, italic?, strike?, code? }
  | { type:'link', href:string, children:Inline[] }
  | { type:'image', alt:string }             // 1차 placeholder
```
포맷 중립이라 추후 text/html serializer 가 같은 IR 소비.

## 충실도 매핑 (1차)

| docx(OOXML) | IR | markdown |
|---|---|---|
| `w:pStyle` Heading1~6 | heading.level | `#`~`######` |
| `<w:p>` | paragraph | 단락(빈 줄 구분) |
| `<w:r>` `w:b`/`w:i`/`w:strike` | inline marks | `**`/`*`/`~~` |
| `<w:hyperlink r:id→rels>` | link | `[text](url)` |
| `numbering.xml`(numId/ilvl) | list(ordered/unordered, 중첩) | `1.` / `-` (들여쓰기) |
| `<w:tbl>/<w:tr>/<w:tc>` | table | GFM 표 |
| `<w:drawing>` 이미지 | image | `![alt]()` placeholder |

엣지: 빈 단락 → 빈 줄, 셀 내 강조 유지, 중첩 리스트 ilvl 기반 들여쓰기, 표 안 인라인.

## 테스트 (vitest)

- **Round-trip**: 대표 HTML → `generateContainer` → docx → `docxToMarkdown` → md 가 핵심 요소(헤딩/표/리스트/강조/링크) 보존하는지. 정방향 자산을 역방향 검증에 재활용.
- 단위: IR 매핑별(heading/run marks/list/table) + 엣지(빈 단락·중첩 리스트·셀 내 강조·하이퍼링크 rels 해석).
- 픽스처: 새 docx 픽스처는 `generateContainer` 로 생성(별도 바이너리 커밋 최소화).

## 비범위 (이번 제외)
- 이미지 실제 추출(base64/media 저장) — placeholder 만.
- `docx → text/html` serializer — IR 은 대비하되 미구현.
- 머리말/꼬리말·각주·코멘트·스타일 세부(색·폰트)·PDF.
- `markdown → docx` 등 다른 매트릭스 방향.

## 리스크 / 확인
- htmlparser2 `xmlMode` 의 네임스페이스 태그(`w:p`)·self-closing 처리 — 구현 1단계 PoC 게이트.
- numbering 중첩/연속성(numId 인스턴스, ilvl) 해석 복잡도 — 1차는 흔한 ol/ul·중첩까지, 복합 번호양식은 차수.
- 브라우저 빌드(JSZip/htmlparser2 번들) 영향 — 코어 브라우저 안전 유지 확인.
