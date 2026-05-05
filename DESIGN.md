# AI 바이탈 매니저 — 디자인 시스템 (초안)

코드·Tailwind 설정·`/design-review` 추출 결과를 바탕으로 한 **실구현 기준(source of truth)** 초안이다. 스크린샷 기반 검증 전 단계이므로, 라이브 감사 후 숫자·등급을 조정할 것.

---

## 1. 제품 톤

| 항목 | 방향 |
|------|------|
| 분류 | **앱 UI** — 단일 워크스페이스, 폼·카드·패널 중심 |
| 한 줄 | 실용 도구(tool-like), 의료 베타 제품 느낌; 과장 마케팅 톤 지양 |
| 언어 | UI 카피 기본 **한국어**, `lang="ko"` |

---

## 2. 타이포그래피

| 토큰 | 값 |
|------|-----|
| 본문 패밀리 | **Pretendard** (`tailwind.config` → `font-sans`) |
| 로드 | `layout.tsx` — jsDelivr 정적 CSS |
| 폴백 | 시스템 산세리프 (Apple, Segoe, Roboto) |

**관례 (컴포넌트에서 반복되는 계층)**

| 용도 | 대표 클래스 |
|------|-------------|
| 페이지/브랜드 타이틀 | `text-lg font-bold tracking-tight text-slate-900` |
| 섹션 제목 | `text-base font-semibold text-slate-900` |
| 본문 | `text-sm text-slate-800` |
| 보조 설명 | `text-xs text-slate-500` |
| 라벨 | `text-xs font-medium text-slate-600` 또는 `font-semibold text-slate-700` |

본문 **14px(`text-sm`)** 이상 유지. 캡션 **`text-xs`(12px)** 는 라벨·메타에만 사용하고, 중요한 경고 문구는 가능하면 `text-sm` 이상과 대비 확보.

---

## 3. 색

### 3.1 브랜드 (티얼)

`extend.colors.brand` — **50~900** 스케일. 주요 사용:

- **강조 / 주 버튼:** `brand-600`, `brand-500`
- **배경 틴트:** `brand-50`, `brand-100`
- **테두리·호버:** `brand-200` ~ `brand-400`

페이지 배경: `bg-gradient-to-br from-slate-50 via-white to-brand-50/30` 처럼 **슬레이트 + 아주 약한 브랜드 틴트**.

### 3.2 중립

- 텍스트: `slate-900` ~ `slate-400`
- 카드·표면: `white`, `slate-50`
- 구분선·링: `border-slate-200`, `ring-slate-200/70`

### 3.3 시맨틱 (상태)

| 의미 | 배경·테두리 패턴 |
|------|-------------------|
| 안전·성공 | `emerald-50`, `emerald-800`, `ring-emerald-200` |
| 주의 | `amber-50`, `amber-900`, `ring-amber-200` |
| 위험·오류 | `rose-50`, `rose-900`, `ring-rose-200` |
| 정보 중립 | `slate-*` |

상호작용·안전 패널 등에서 **emerald / amber / rose** 조합으로 통일한다. 새 기능 추가 시 같은 패턴을 재사용한다.

---

## 4. 간격·레이아웃·그리드

| 패턴 | 값 |
|------|-----|
| 최대 콘텐츠 폭 | `max-w-6xl` |
| 가로 패딩 | `px-6` (헤더·메인 공통) |
| 세로 리듬 | `space-y-6`, `gap-6` (섹션), `gap-4` (카드 그리드) |
| 상단 헤더 | `sticky top-0 z-30`, 얇은 하단 보더 `border-slate-200/70` |

브레이크포인트는 Tailwind 기본 (`sm` `md` `lg`). 메인 레이아웃은 `lg:grid-cols-3` 등으로 **데스크톱 3열 / 모바일 스택**.

---

## 5. 반경·그림자·테두리

| 레벨 | 반경 | 용도 |
|------|------|------|
| 소형 컨트롤 | `rounded-lg` | 아이콘 버튼, 칩 |
| 입력·버튼 | `rounded-xl` | 기본 상호작용 요소 |
| 카드·패널·섹션 | `rounded-2xl` | 주요 블록 |

| 토큰 | 용도 |
|------|------|
| `shadow-card` | 카드·패널 기본 입체감 |
| `shadow-soft` | 토스트 등 떠 있는 요소 |
| `ring-1 ring-slate-200/70` | 카드 외곽 정의 (밝은 배경에서) |

같은 화면에서 **rounded-xl만 과하게 반복**되면 계층이 평평해 보일 수 있다. 큰 컨테이너는 `rounded-2xl`, 내부 버튼은 `rounded-xl`로 구분하는 현재 관례를 유지한다.

---

## 6. 컴포넌트 패턴

### 카드형 패널

`rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70` — 도구형 섹션(상호작용·영양·안전 등)의 기본 래퍼.

### 주요 버튼

- 채움(다크): `bg-slate-900` + `hover:bg-slate-800` 또는 브랜드 `bg-brand-600`
- 테두리: `border border-slate-200 bg-white` + 브랜드/로즈 호버

### 폼

입력: `rounded-xl border border-slate-200 bg-slate-50`, 포커스 시 `focus:border-brand-*`, `focus:ring-2 focus:ring-brand-100` 패턴.

### 헤더 마크

아이콘을 `rounded-xl` 컨테이너에 두고 `bg-gradient-to-br from-brand-500 to-brand-700` 로 브랜드 앵커를 만든다.

---

## 7. 상호작용·접근성

| 규칙 | 구현 |
|------|------|
| 키보드 포커스 | 버튼 등에 **`focus-ring`** 클래스 (`globals.css`) — `focus-visible` 링, 오프셋 `slate-50` |
| 토스트 | 래퍼에 `role="status"` `aria-live="polite"` `aria-atomic="true"` |
| 접이식 섹션 | 가능하면 **`aria-expanded`** (예: 안전 판정 토글) |

포커스 링은 **마우스 클릭에는 노출 최소화**, 키보드 탐색에서 노출.

---

## 8. 모션

| 요소 | 동작 |
|------|------|
| 토스트 등장 | `.animate-fade-in-up` — `fadeInUp` 0.35s ease-out |
| 감도 | **`prefers-reduced-motion: reduce`** 일 때 동일 클래스 **애니메이션 없음** (`globals.css`) |

장식용 무한 애니메이션은 피한다. `animate-pulse` 등은 베타 배지처럼 **아주 작은 면적**에만 사용.

---

## 9. 알려진 개선 여지 (감사 반영)

다음은 DESIGN 위반보다 **일관성·폴리시** 목록이다.

1. ~~**StatsBar** 두 번째 KPI~~ — `하루 복용` 타일을 `from-brand-400 to-brand-600`으로 정렬함 (`FINDING-004`, 스킬 `/design-review`).
2. 빈 상태(EmptyState) 아이콘 박스는 기능적으로 문제 없으나, **아이콘+그라데이션 원형** 패턴이 일반 SaaS 템플릿과 닮을 수 있음. 브랜드 일러스트나 단색으로 바꿀 수 있으면 검토.
3. 단일 URL 앱이라 **스크롤 내 섹션 구분**(앵커 링크, 눈에 띄는 섹션 헤더)이 트렁크 테스트에 도움이 됨.

---

## 10. 파일과 책임

| 파일 | 역할 |
|------|------|
| `tailwind.config.ts` | 브랜드 색, `font-sans`, `shadow-*` |
| `app/globals.css` | CSS 변수(배경/전경), 스크롤바 유틸, `focus-ring`, `fadeInUp`, reduced-motion |
| `app/layout.tsx` | Pretendard 로드, `lang`, 본문 클래스 |

새 UI 추가 시 **먼저 기존 컴포넌트의 클래스 패턴을 복제**하고, 공통화가 필요하면 여기에 한 줄 규칙을 추가한 뒤 리팩터한다.

---

## 11. 버전

| 날짜 | 내용 |
|------|------|
| 2026-05-06 | 초안 작성 — Inferred design system + 코드 스캔 기준 |
| 2026-05-06 | StatsBar KPI2 그라데이션 브랜드 정렬, DESIGN.md 리포지토리 추가 |

라이브 디자인 리뷰(스크린샷·대비 측정) 후 표·임계값을 업데이트한다.
