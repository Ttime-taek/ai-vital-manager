# 💊 AI 바이탈 매니저 (AI Vital Manager)

처방받은 약 이름을 입력하면 **복약 스케줄**과 **함께 먹으면 안 되는 음식**을 자동으로 알려주는 Next.js + Tailwind CSS 기반 대시보드 웹 앱입니다.

## ✨ 주요 기능

- 🔍 **약물 검색** — 한국어/영어/상품명/일반명 어떤 형태로 입력해도 자동 매칭
- 📅 **자동 복약 스케줄** — 약별 권장 횟수에 따라 아침/점심/저녁/취침 전 시간대로 자동 분배
- 🍽 **음식 상호작용 경고** — 자몽주스, 우유, 알코올, 비타민 K 식품 등 약효를 떨어뜨리거나 위험한 음식 자동 식별
- 🤖 **AI 보강 (선택)** — 내장 DB에 없는 약물은 Google Gemini API로 분석
- 📊 **요약 통계** — 등록 약물 수, 하루 복용 횟수, 주의 음식 개수를 한눈에

## 🏗 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| 스타일 | Tailwind CSS, Pretendard 한국어 폰트 |
| 아이콘 | lucide-react |
| AI 엔진 (선택) | Google Gemini 1.5 Flash |
| 약물 DB | 로컬 JSON 기반 + AI Fallback |

## 🚀 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속하면 됩니다.

## 🔐 환경 변수 설정 (선택)

내장 DB에 등록되지 않은 약물에 대해서도 분석을 받으려면 Gemini API 키를 설정하세요.

1. `.env.example` 파일을 `.env.local`로 복사
2. `GEMINI_API_KEY`에 [Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급받은 키 입력

```bash
# .env.local
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-flash
```

> ⚠️ **보안**: `.env`, `.env.local` 파일은 절대 Git에 커밋하지 마세요. `.gitignore`에 이미 등록되어 있습니다.

## 📁 프로젝트 구조

```
.
├── app/
│   ├── api/analyze/route.ts   # 약물 분석 API (DB → AI fallback)
│   ├── globals.css            # Tailwind + 글로벌 스타일
│   ├── layout.tsx             # 루트 레이아웃 (Pretendard 폰트)
│   └── page.tsx               # 메인 대시보드 페이지
├── components/
│   ├── Header.tsx
│   ├── MedicationInput.tsx    # 약물 입력 폼 + 빠른 선택
│   ├── MedicationCard.tsx     # 개별 약물 정보 카드
│   ├── ScheduleTimeline.tsx   # 시간대별 복약 타임라인
│   ├── WarningPanel.tsx       # 음식 상호작용 통합 경고
│   ├── StatsBar.tsx           # 상단 요약 카드
│   └── EmptyState.tsx
├── lib/
│   ├── medications.ts         # 로컬 약물 DB (13종)
│   ├── scheduleEngine.ts      # 복용 횟수 → 시간대 분배 로직
│   └── types.ts               # 타입 정의
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```

## 💊 내장된 약물 DB

타이레놀, 이부프로펜, 아스피린, 와파린, 암로디핀, 심바스타틴, 메트포르민, 오메프라졸, 레보티록신, 시프로플록사신, 아목시실린, 디아제팜, 프레드니솔론 등 13종의 자주 처방되는 약물 정보를 내장하고 있습니다.

## ⚠️ 면책 조항

본 서비스가 제공하는 모든 정보는 **일반적인 참고용**이며, 의료 진단·처방을 대체할 수 없습니다.  
실제 복약은 반드시 의사 또는 약사의 지시에 따라 진행하세요.

## 📜 라이선스

MIT
