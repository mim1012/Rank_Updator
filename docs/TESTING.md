# Test Documentation - Turafic 시스템

**버전**: 1.0
**작성일**: 2025-12-29
**프로젝트**: Turafic (네이버/쿠팡 순위 최적화 AI 시스템)

---

## 1. 개요

이 문서는 Turafic 시스템의 테스트 전략, 범위, 실행 방법을 정의합니다.

---

## 2. 테스트 전략

### 2.1 테스트 레벨

```
┌─────────────────────────────────────────────────────────────┐
│                     E2E 테스트                               │
│          (전체 시스템 흐름 검증)                              │
├─────────────────────────────────────────────────────────────┤
│                    통합 테스트                               │
│        (API, 데이터베이스, 외부 연동)                         │
├─────────────────────────────────────────────────────────────┤
│                    단위 테스트                               │
│        (개별 함수, 모듈, 서비스)                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 테스트 유형

| 유형 | 설명 | 도구 |
|-----|------|------|
| **단위 테스트** | 개별 함수/모듈 검증 | Vitest |
| **통합 테스트** | API/DB 연동 검증 | Vitest, Supertest |
| **E2E 테스트** | 전체 흐름 검증 | Playwright (예정) |
| **성능 테스트** | 부하/응답 시간 | k6 (예정) |

### 2.3 테스트 커버리지 목표

| 영역 | 목표 커버리지 |
|------|-------------|
| 서비스 로직 | 80% 이상 |
| API 라우터 | 70% 이상 |
| 유틸리티 함수 | 90% 이상 |
| 전체 | 75% 이상 |

---

## 3. 테스트 범위

### 3.1 서버 (Backend)

#### 3.1.1 서비스 테스트

| 서비스 | 테스트 항목 |
|-------|-----------|
| `variableCombinations.ts` | 변수 생성, 진화, 선택 |
| `variableConverter.ts` | AdPang ↔ Turafic 변환 |
| `rankCheckService.ts` | 순위 체크 로직 |
| `botManager.ts` | 봇 상태 관리 |

#### 3.1.2 API 라우터 테스트

| 라우터 | 엔드포인트 | 테스트 케이스 |
|-------|----------|-------------|
| `rankCheck` | `registerBot` | 봇 등록 성공/실패 |
| `rankCheck` | `getTask` | 작업 획득/대기/없음 |
| `rankCheck` | `reportRank` | 순위 보고 성공/실패 |
| `campaign` | `create` | 캠페인 생성 |
| `campaign` | `list` | 캠페인 목록 조회 |

### 3.2 순위 체크 모듈

| 모듈 | 테스트 항목 |
|-----|-----------|
| `parallel-rank-checker.ts` | 병렬 처리, 재시도 로직 |
| `check-batch-worker-pool.ts` | 워커 풀 관리 |
| HTTP 헤더 생성 | 변수별 헤더 생성 검증 |

### 3.3 외부 연동

| 연동 대상 | 테스트 유형 |
|---------|-----------|
| Zero API | Mock 테스트 |
| PostgreSQL | 실제 DB 테스트 (Docker) |
| Supabase | Mock 테스트 |

---

## 4. 테스트 실행

### 4.1 로컬 환경 설정

```bash
# 1. 의존성 설치
pnpm install

# 2. 테스트용 데이터베이스 시작
pnpm db:up

# 3. 테스트 환경 변수 설정
cp .env.example .env.test
```

### 4.2 테스트 명령어

```bash
# 전체 테스트 실행
pnpm test

# 특정 파일 테스트
pnpm test variableConverter

# 감시 모드
pnpm test:watch

# 커버리지 리포트
pnpm test:coverage
```

### 4.3 테스트 환경 변수

```env
# .env.test
DATABASE_URL=postgresql://postgres:password@localhost:5432/turafic_test
NODE_ENV=test
ZERO_API_BASE_URL=http://localhost:3001/mock
```

---

## 5. 단위 테스트 예시

### 5.1 변수 변환 테스트

```typescript
// server/services/__tests__/variableConverter.test.ts
import { describe, it, expect } from 'vitest';
import { convertAdPangToTurafic, convertTuraficToAdPang } from '../variableConverter';

describe('variableConverter', () => {
  describe('convertAdPangToTurafic', () => {
    it('should convert AdPang variables to Turafic format', () => {
      const adpangVars = {
        ua_change: true,
        cookie_home_mode: 'login',
        shop_home: true,
        use_nid: true,
        use_image: true,
        work_type: '검색+클릭+체류',
        random_click_count: 6,
        work_more: true,
        sec_fetch_site_mode: 'same-site',
        low_delay: true,
      };

      const result = convertAdPangToTurafic(adpangVars);

      expect(result.user_agent).toBe('UA71');
      expect(result.cookie_strategy).toBe('로그인쿠키');
      expect(result.entry_point).toBe('쇼핑DI');
      expect(result.work_type).toBe('검색+클릭+체류');
      expect(result.random_clicks).toBe(6);
    });

    it('should handle default values', () => {
      const adpangVars = {
        ua_change: false,
        cookie_home_mode: 'nologin',
      };

      const result = convertAdPangToTurafic(adpangVars);

      expect(result.user_agent).toBe('UA58');
      expect(result.cookie_strategy).toBe('비로그인쿠키');
    });
  });

  describe('convertTuraficToAdPang', () => {
    it('should convert Turafic variables to AdPang format', () => {
      const turaficVars = {
        user_agent: 'UA71',
        cookie_strategy: '로그인쿠키',
        entry_point: '쇼핑DI',
        random_clicks: 3,
      };

      const result = convertTuraficToAdPang(turaficVars);

      expect(result.ua_change).toBe(true);
      expect(result.cookie_home_mode).toBe('login');
      expect(result.shop_home).toBe(true);
    });
  });
});
```

### 5.2 순위 계산 테스트

```typescript
// rank-check/__tests__/rankCalculation.test.ts
import { describe, it, expect } from 'vitest';

function calculateRank(page: number, index: number, pageSize: number = 40): number {
  return (page - 1) * pageSize + index + 1;
}

describe('Rank Calculation', () => {
  it('should calculate rank for first page', () => {
    expect(calculateRank(1, 0)).toBe(1);
    expect(calculateRank(1, 9)).toBe(10);
    expect(calculateRank(1, 39)).toBe(40);
  });

  it('should calculate rank for second page', () => {
    expect(calculateRank(2, 0)).toBe(41);
    expect(calculateRank(2, 9)).toBe(50);
  });

  it('should calculate rank for tenth page', () => {
    expect(calculateRank(10, 0)).toBe(361);
    expect(calculateRank(10, 39)).toBe(400);
  });
});
```

---

## 6. 통합 테스트 예시

### 6.1 API 라우터 테스트

```typescript
// server/__tests__/routers.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from '../test-utils';

describe('rankCheck Router', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('registerBot', () => {
    it('should register a new bot', async () => {
      const result = await server.trpc.rankCheck.registerBot({
        deviceId: 'test-device-001',
        deviceModel: 'Samsung Galaxy S21',
      });

      expect(result.success).toBe(true);
      expect(result.botId).toBeDefined();
    });

    it('should reject duplicate deviceId', async () => {
      await server.trpc.rankCheck.registerBot({
        deviceId: 'duplicate-device',
        deviceModel: 'Test Device',
      });

      await expect(
        server.trpc.rankCheck.registerBot({
          deviceId: 'duplicate-device',
          deviceModel: 'Test Device',
        })
      ).rejects.toThrow();
    });
  });

  describe('getTask', () => {
    it('should return task when available', async () => {
      // Setup: 캠페인 생성
      await server.db.insert(campaigns).values({
        name: 'Test Campaign',
        keyword: '테스트 키워드',
        productId: '12345678',
        status: 'active',
      });

      const result = await server.trpc.rankCheck.getTask({
        botId: 1,
        loginId: 'test',
        imei: '123456',
      });

      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(result.task.keyword).toBe('테스트 키워드');
    });

    it('should return empty when no tasks available', async () => {
      const result = await server.trpc.rankCheck.getTask({
        botId: 999,
        loginId: 'test',
        imei: '123456',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('No tasks available');
    });
  });
});
```

### 6.2 데이터베이스 테스트

```typescript
// drizzle/__tests__/schema.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { campaigns, bots, rankings } from '../schema';

describe('Database Schema', () => {
  beforeEach(async () => {
    // 테스트 데이터 정리
    await db.delete(rankings);
    await db.delete(campaigns);
    await db.delete(bots);
  });

  it('should create campaign with required fields', async () => {
    const [campaign] = await db.insert(campaigns).values({
      name: 'Test Campaign',
      keyword: '갤럭시 S24',
      productId: '12345678',
      platform: 'naver',
      status: 'active',
    }).returning();

    expect(campaign.id).toBeDefined();
    expect(campaign.name).toBe('Test Campaign');
    expect(campaign.createdAt).toBeDefined();
  });

  it('should enforce foreign key constraint on rankings', async () => {
    await expect(
      db.insert(rankings).values({
        campaignId: 99999, // 존재하지 않는 캠페인
        botId: 1,
        rank: 10,
        success: true,
      })
    ).rejects.toThrow();
  });
});
```

---

## 7. E2E 테스트 시나리오

### 7.1 전체 순위 체크 흐름

```
시나리오: 전체 순위 체크 워크플로우

Given 시스템이 실행 중이다
  And 활성 캠페인 "갤럭시 S24 순위 체크"가 존재한다
  And 봇 "bot-001"이 등록되어 있다

When 봇이 작업을 요청한다 (getTask)
Then 봇이 순위 체크 작업을 받는다
  And 작업에 키워드와 상품ID가 포함되어 있다
  And 작업에 변수 조합이 포함되어 있다

When 봇이 네이버 쇼핑에서 순위를 체크한다
Then 상품이 검색 결과에서 발견된다
  And 순위가 계산된다 (예: 45위)

When 봇이 순위를 보고한다 (reportRank)
Then 순위가 DB에 저장된다
  And Zero API에 순위가 보고된다

When 봇이 작업을 완료한다 (finishTask)
Then 작업 상태가 "completed"로 변경된다
  And 캠페인 통계가 업데이트된다
```

### 7.2 봇 장애 복구 흐름

```
시나리오: 봇 오프라인 자동 복구

Given Bot Agent가 활성화되어 있다
  And 봇 "bot-003"이 온라인 상태이다

When 봇 "bot-003"이 10분 이상 응답하지 않는다
Then Bot Agent가 오프라인 상태를 감지한다

When Bot Agent가 복구를 시도한다
Then 봇에 재시작 명령이 전송된다

Given 복구가 성공한다
Then 봇 상태가 "online"으로 변경된다
  And 복구 로그가 기록된다

Given 복구가 3회 실패한다
Then 운영자에게 알림이 전송된다
  And 봇 상태가 "error"로 유지된다
```

---

## 8. 테스트 데이터

### 8.1 Fixture 데이터

```typescript
// test/fixtures/campaigns.ts
export const testCampaigns = [
  {
    id: 1,
    name: '갤럭시 S24 순위 체크',
    keyword: '갤럭시 S24',
    productId: '12345678',
    platform: 'naver',
    status: 'active',
  },
  {
    id: 2,
    name: '아이폰 15 순위 체크',
    keyword: '아이폰 15',
    productId: '87654321',
    platform: 'naver',
    status: 'paused',
  },
];

// test/fixtures/bots.ts
export const testBots = [
  {
    id: 1,
    deviceId: 'bot-001',
    deviceModel: 'Samsung Galaxy S21',
    status: 'online',
  },
  {
    id: 2,
    deviceId: 'bot-002',
    deviceModel: 'Samsung Galaxy S22',
    status: 'online',
  },
];
```

### 8.2 Mock 데이터

```typescript
// test/mocks/zeroApi.ts
export const mockZeroApi = {
  getKeywords: vi.fn().mockResolvedValue([
    { keyword: '갤럭시 S24', productId: '12345678' },
    { keyword: '아이폰 15', productId: '87654321' },
  ]),

  reportRank: vi.fn().mockResolvedValue({ success: true }),
};
```

---

## 9. CI/CD 통합

### 9.1 GitHub Actions 설정

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
          POSTGRES_DB: turafic_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - run: pnpm db:push
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/turafic_test

      - run: pnpm test:coverage

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## 10. 테스트 보고서

### 10.1 커버리지 리포트 위치

```
coverage/
├── lcov.info          # LCOV 형식
├── lcov-report/       # HTML 리포트
│   └── index.html
└── coverage-summary.json
```

### 10.2 테스트 결과 확인

```bash
# 커버리지 리포트 열기 (브라우저)
open coverage/lcov-report/index.html

# 요약 확인
cat coverage/coverage-summary.json
```

---

## 11. 알려진 제한사항

### 11.1 테스트 불가 영역

| 영역 | 이유 | 대안 |
|-----|------|------|
| 네이버 쇼핑 실제 접속 | IP 차단 위험 | Mock HTML 사용 |
| Android Bot | 실제 디바이스 필요 | 에뮬레이터/Mock |
| Zero API 프로덕션 | 외부 시스템 | Mock 서버 |

### 11.2 Flaky 테스트 관리

- 타이밍 의존 테스트에 적절한 대기 시간 설정
- 외부 의존성 Mock 처리
- 재시도 로직 적용

---

## 12. 참고 문서

- [Vitest 공식 문서](https://vitest.dev/)
- [Drizzle ORM 테스트](https://orm.drizzle.team/docs/testing)
- [tRPC 테스트 가이드](https://trpc.io/docs/client/testing)

---

**작성자**: Claude Code
**마지막 업데이트**: 2025-12-29
