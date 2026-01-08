# Turafic - AI 기반 네이버/쿠팡 순위 최적화 시스템

[![Version](https://img.shields.io/badge/version-v0.3.0-blue.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue.svg)]()

## 개요

**Turafic**은 네이버/쿠팡 쇼핑몰 검색 순위를 자동으로 체크하고 최적화하는 **완전 자율 AI Agentic 시스템**입니다.

### 핵심 기능

- **자동 순위 체크**: 24/7 무인 순위 모니터링
- **변수 최적화**: 12개 변수 조합을 통한 유전 알고리즘 기반 최적화
- **분산 봇 네트워크**: 다수의 Android 봇 동시 운영
- **AI Agent 협업**: 5개 전문 Agent가 자율적으로 의사결정

### 해결하는 문제

1. **수동 순위 체크의 비효율성**: 키워드별 수동 확인 → 자동화
2. **순위 변동 대응 지연**: 실시간 모니터링 및 알림
3. **최적화 전략 부재**: AI 기반 변수 조합 최적화

---

## 빠른 시작

### 사전 요구사항

- Node.js 20+
- pnpm
- Docker Desktop (PostgreSQL용)

### 설치

```bash
# 1. 저장소 클론
git clone https://github.com/your-org/turafic.git
cd turafic

# 2. 의존성 설치
pnpm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일 수정

# 4. 데이터베이스 시작
pnpm db:up

# 5. 마이그레이션 실행
pnpm db:push

# 6. 개발 서버 시작
pnpm dev
```

### 주요 스크립트

| 스크립트 | 설명 |
|---------|------|
| `pnpm dev` | 개발 서버 시작 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm db:up` | PostgreSQL 컨테이너 시작 |
| `pnpm db:push` | DB 마이그레이션 |
| `pnpm db:studio` | Drizzle Studio (DB GUI) |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                  Turafic Web Dashboard                      │
│                  (React + TailwindCSS)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │ tRPC
┌───────────────────────▼─────────────────────────────────────┐
│               Turafic Server (Node.js + tRPC)               │
│  ├─ Campaign Router (캠페인 관리)                            │
│  ├─ Task Router (작업 큐)                                    │
│  ├─ Bot Router (봇 네트워크)                                 │
│  └─ Variable Router (변수 최적화)                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
   │Bot 1    │    │Bot 2    │    │Bot N    │
   │(Android)│    │(Android)│    │(Android)│
   └─────────┘    └─────────┘    └─────────┘
```

---

## AI Agent 시스템

5개의 전문 AI Agent가 협력하여 시스템을 운영합니다:

| Agent | 역할 | 슬래시 커맨드 |
|-------|------|-------------|
| **Orchestrator** | 전체 시스템 조율 | - |
| **Variable Agent** | 변수 조합 최적화 | `/evolve`, `/test` |
| **Bot Agent** | 봇 네트워크 관리 | `/bot` |
| **Campaign Agent** | 캠페인 실행 | `/campaign` |
| **Analysis Agent** | 순위 분석 | `/analyze` |

---

## 프로젝트 구조

```
turafic/
├── .claude/              # Claude Code 설정
│   ├── commands/         # 슬래시 커맨드
│   └── skills/           # 자동화 스킬
├── agents/               # AI Agent 정의
├── client/               # React 프론트엔드
├── server/               # Node.js 백엔드
│   ├── services/         # 비즈니스 로직
│   └── routers.ts        # tRPC API
├── docs/                 # 문서
│   ├── api/              # API 명세
│   ├── prd/              # 요구사항
│   └── dashboard.md      # 실시간 대시보드
├── drizzle/              # DB 스키마
└── rank-check/           # 순위 체크 모듈
```

---

## 문서

### 시작하기
- [Database Setup Guide](docs/DATABASE_SETUP.md)
- [API Reference](docs/api/RANK_CHECK_API.md)

### 설계
- [System Design](docs/SYSTEM_DESIGN.md)
- [Variable Mapping](docs/VARIABLE_MAPPING.md)

### 운영
- [Dashboard](docs/dashboard.md)
- [Integration Summary](docs/INTEGRATION_SUMMARY.md)

### 개발 가이드
- [CLAUDE.md](CLAUDE.md) - AI Agent 시스템 가이드

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React, TailwindCSS, tRPC Client |
| **Backend** | Node.js, tRPC, Express |
| **Database** | PostgreSQL 17, Drizzle ORM |
| **Mobile** | Android (Kotlin), WebView |
| **AI** | Claude AI Agentic System |
| **Infra** | Docker, AWS |

---

## 환경 변수

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/turafic

# Zero API (외부 연동)
ZERO_API_BASE_URL=https://api.zero.com
ZERO_API_KEY=your-api-key

# Server
PORT=5000
NODE_ENV=development
```

---

## 라이선스

Private - All Rights Reserved

---

**마지막 업데이트**: 2025-12-29
