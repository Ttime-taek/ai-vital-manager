# AI 바이탈 매니저 (AI Vital Manager)

처방받은 약 이름을 입력하면 **복약 스케줄**, **음식 상호작용**, **약물 상호작용(선택)**, **영양/보충제 스태킹 참고(선택)**를 한 화면에서 볼 수 있는 Next.js + Tailwind 기반 웹 앱입니다.

## 주요 기능

- 약물 검색 — 로컬 DB + **웹 검색(openFDA 등)** + Gemini/Cerebras AI 보강 (DB보다 더 좋으면 자동 대체)
- 자동 복약 스케줄 — 횟수에 따라 시간대 분배
- 음식 상호작용 경고 — 자몽주스, 알코올 등
- 약물 상호작용 점검 — 로컬 규칙, openFDA 경로, (옵션) 상용 API, 주의/금기 시 LLM 설명
- 30초 안전 판정 — 간단 문진 + 규칙 기반 참고
- 영양 DB — USDA 검색·fdcId, Open Food Facts 바코드로 프로필 추출 후 보충제 성분 합산·스태킹 경고

의료 진단·처방을 대체하지 않습니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| 스타일 | Tailwind CSS |
| 검증 | Zod |
| 테스트 | Vitest |

## 빠른 시작

### Windows (권장)

Next.js 14는 **Node 20 LTS**에서 가장 안정적입니다. `fix-deps.bat`가 `%LOCALAPPDATA%\ai-vital-manager\node-v20`에 Node 20을 설치합니다(프로젝트 밖 — 파일 감시 충돌 방지).

1. `fix-deps.bat` — 최초 1회(또는 의존성 꼬였을 때)
2. `start.bat` — 개발 서버 실행 (창을 닫지 마세요). `Ready` 후 바로 꺼지면 `start-live.bat` 또는 포트 `3001` 시도.
3. 브라우저에서 [http://localhost:3000](http://localhost:3000)

`Ready` 직후 `Compiling /`에서 종료되면 `next`와 `@next/swc-win32-x64-msvc` 버전이 어긋난 경우가 많습니다. `start.bat`가 `check-next-swc`로 막으면 **`quick-fix-swc.bat`** (SWC만 맞춤) 또는 **`fix-deps.bat`** (전체 재설치)를 실행하세요. `npm warn cleanup ... EPERM`이 나오면 `fix-deps.bat`가 자동으로 `node_modules`를 비운 뒤 재시도합니다.

문제가 계속되면 `diagnose-dev.bat` 실행 후 `.gstack\dev-live.log` 내용을 확인하세요.

PowerShell에서는 `npm` 대신 **`npm.cmd`** 를 쓰거나 `start.bat`를 사용하세요. `node --version`처럼 명령 이름 없이 `--version`만 입력하면 오류가 납니다.

### macOS / Linux

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)

```bash
npm test
npm run build
```

## 환경 변수

`.env.example`을 `.env.local`로 복사한 뒤 필요한 항목만 채웁니다.

| 변수 | 용도 |
|------|------|
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 약물 AI 분석, 상호작용 설명 (**필수에 가까움**) |
| `CEREBRAS_API_KEY`, `CEREBRAS_MODEL`, `CEREBRAS_BASE_URL` | Gemini 대체/폴백 |
| `AI_PROVIDER` | `analyze` 라우트: `auto` / `gemini` / `cerebras` |
| `MEDICATION_WEB_SEARCH` | `0`이면 웹 검색 비활성 (기본: 활성) |
| `SERPER_API_KEY` | Google 검색 — **한국어 약물 웹 검색 품질 향상 (Vercel 권장)** |
| `TAVILY_API_KEY` | Tavily 검색 (선택, Serper 대안) |
| `INTERACTIONS_LLM_ORDER` | `interactions` 라우트 LLM 순서 (예: `gemini,cerebras`) |
| `COMMERCIAL_DI_*` | 상용 상호작용 API 연동 시 |
| `USDA_FDC_API_KEY` | 영양 DB(프로덕션에서 권장) |

`SERPER_API_KEY` / `TAVILY_API_KEY` 없이도 `GEMINI_API_KEY` 또는 `CEREBRAS_API_KEY`만으로 동작합니다. 다만 한국어·최신 약물 정보는 Serper 설정 시 훨씬 좋아집니다.

실제 키가 들어간 파일은 Git에 커밋하지 마세요.

## Vercel 배포

프로덕션: [https://ai-vital-manager-xmi5.vercel.app](https://ai-vital-manager-xmi5.vercel.app)

### 환경 변수 (Vercel Dashboard → Settings → Environment Variables)

| 우선순위 | 변수 | 설명 |
|----------|------|------|
| 필수 | `GEMINI_API_KEY` 또는 `CEREBRAS_API_KEY` | AI 약물 분석 |
| 권장 | `SERPER_API_KEY` | Google 검색 — 한국어 약물 웹 검색 ([serper.dev](https://serper.dev)) |
| 선택 | `TAVILY_API_KEY` | Tavily 검색 (Serper 대안) |
| 선택 | `GEMINI_MODEL`, `AI_PROVIDER`, `CEREBRAS_*` | 모델·폴백 순서 |

Production / Preview / Development 모두에 동일하게 넣은 뒤 **Redeploy** 하세요.

### `.env.local` → Vercel 일괄 동기화 (Windows)

```powershell
# Windows: npx vercel 이 "Could not determine Node.js install directory" 로 실패할 수 있음
powershell -ExecutionPolicy Bypass -File .\scripts\vercel-setup.ps1   # login + link (1회)
powershell -ExecutionPolicy Bypass -File .\scripts\sync-vercel-env.ps1
# 또는: .\scripts\sync-vercel-env.bat
```

`vercel-setup.ps1` — 브라우저 로그인 후 `ai-vital-manager-xmi5` 프로젝트 연결  
`sync-vercel-env.ps1` — `.env.local`의 AI·웹 검색 키(`SERPER_API_KEY`, `TAVILY_API_KEY` 포함)를 Vercel에 반영  
배포는 GitHub push 자동 배포 또는 Vercel Dashboard → Deployments → Redeploy

### 배포 후 확인 (스모크 테스트)

1. **DB에 없는 약** — 예: 처음 보는 약 이름 입력 → 카드 배지 **웹·AI** 또는 **AI 분석**, 식이 가이드 표시
2. **DB에 있는 약** — **위고비** 입력 → 웹·AI가 DB보다 풍부하면 배지 **AI 보강** (`database_enriched`)
3. API 키 미설정 시 — fallback 안내 토스트, **내장 DB**만 즉시 반환(타이레놀 등)

## 프로젝트 구조 (요약)

```
app/
  page.tsx                 # 대시보드
  api/analyze/             # 약물 분석
  api/interactions/        # 약물 상호작용
  api/safety/              # 안전 판정
  api/nutrition/product/   # USDA/OFF + 스태킹
components/                # UI
lib/                       # 도메인 로직, 외부 API 클라이언트
```

## 면책

제공 정보는 참고용입니다. 복약·치료 결정은 의사·약사와 상담하세요.

## 라이선스

MIT
