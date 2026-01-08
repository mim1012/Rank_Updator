# Rank Check Module - Architecture Documentation

**Generated:** 2026-01-02
**Module:** `rank-check/`
**Purpose:** 네이버 쇼핑 순위 체크 및 테스트 상품 수집 자동화

---

## 📋 Executive Summary

`rank-check` 모듈은 네이버 모바일 쇼핑(m.naver.com)에서 특정 키워드의 상품 순위를 자동으로 체크하고, 300~400위권 범위의 테스트 상품을 수집하는 자동화 시스템입니다.

### 핵심 기능

1. **정확한 순위 체크** - Puppeteer/Patchright 기반 브라우저 자동화로 최대 15페이지(~600위) 추적
2. **테스트 상품 수집** - 메인 키워드(예: "장난감", "충전기")로 300~400위권 상품명 + URL 자동 수집
3. **봇 탐지 회피** - 인간 행동 시뮬레이션(스크롤, 타이핑, 랜덤 딜레이)
4. **CAPTCHA 처리** - 보안 페이지 자동 감지 및 차단 상태 보고
5. **병렬 처리** - Worker Pool 패턴으로 다수 키워드 동시 순위 체크

---

## 🏗️ Architecture Pattern

**Pattern:** Pipeline + Worker Pool
**Browser Automation:** Puppeteer / Patchright (Playwright fork)
**Database:** Supabase (PostgreSQL)

```
┌─────────────────────────────────────────────────────────────────┐
│                   Rank Check Module Architecture                │
└─────────────────────────────────────────────────────────────────┘

Input Layer:
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Supabase         │    │ CLI Command      │    │ API Request      │
│ (slot_navertest) │───▶│ (npx tsx ...)    │───▶│ (tRPC endpoint)  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                                 │
                                 ▼
Core Processing Layer:
┌─────────────────────────────────────────────────────────────────┐
│                     Worker Pool Manager                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Worker 1     │  │ Worker 2     │  │ Worker N     │         │
│  │ (Browser)    │  │ (Browser)    │  │ (Browser)    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
Rank Checking Pipeline:
┌─────────────────────────────────────────────────────────────────┐
│ 1. enterShoppingTab()                                           │
│    ├─ m.naver.com 접속                                          │
│    ├─ 검색창에 키워드 입력 (humanType)                          │
│    └─ 쇼핑탭 클릭                                               │
│                                                                 │
│ 2. hydrateCurrentPage()                                         │
│    ├─ 18단계 인간형 스크롤 (250ms 간격)                         │
│    └─ React Hydration 완료 대기                                │
│                                                                 │
│ 3. collectProductsOnPage(page, pageNum)                        │
│    ├─ DOM 기반 상품 수집 (1페이지)                             │
│    │  ├─ data-shp-contents-id → MID 추출                       │
│    │  ├─ data-shp-contents-rank → 순위 추출                    │
│    │  ├─ title/aria-label → 상품명 추출                        │
│    │  └─ data-shp-inventory → 광고 여부 판별                   │
│    │                                                             │
│    └─ API 인터셉트 (2~15페이지)                                │
│       ├─ /api/search/all 응답 대기                             │
│       ├─ JSON에서 상품 리스트 파싱                             │
│       └─ DOM 폴백 (API 실패 시)                                │
│                                                                 │
│ 4. findAccurateRank(page, keyword, targetMid)                  │
│    ├─ 최대 15페이지 순회                                       │
│    ├─ 매 페이지 5초 안정화 딜레이                              │
│    ├─ 차단 감지 시 즉시 중단                                   │
│    └─ 순위 발견 시 RankResult 반환                            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
Output Layer:
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Supabase Update  │    │ Console Log      │    │ JSON Result      │
│ (current_rank)   │    │ (Progress)       │    │ (API Response)   │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 📦 Component Overview

### 1. Core Rank Checker

**File:** `accurate-rank-checker.ts`

**Key Functions:**

| Function | Purpose | Return Type |
|----------|---------|-------------|
| `findAccurateRank(page, keyword, targetMid, maxPages)` | 메인 순위 체크 함수 - 최대 15페이지 추적 | `RankResult \| null` |
| `enterShoppingTab(page, keyword)` | 네이버 메인 → 검색 → 쇼핑탭 진입 | `Promise<boolean>` |
| `hydrateCurrentPage(page)` | React Hydration 완료 대기 (18단계 스크롤) | `Promise<void>` |
| `collectProductsOnPage(page, pageNum)` | DOM/API에서 상품 리스트 수집 | `Promise<PageScanResult>` |
| `goToPageAndGetAPIData(page, targetPage)` | 페이지 이동 + API 인터셉트 | `Promise<ProductEntry[] \| null \| 'BLOCKED'>` |
| `isBlocked(page)` | CAPTCHA/보안 페이지 감지 | `Promise<boolean>` |

**Data Structures:**

```typescript
interface RankResult {
  found: boolean;          // 순위 발견 여부
  mid: string;             // 상품 MID
  productName: string;     // 상품명
  totalRank: number;       // 전체 순위 (광고 포함)
  organicRank: number;     // 오가닉 순위 (광고 제외)
  isAd: boolean;           // 광고 여부
  page: number;            // 발견된 페이지 번호
  pagePosition: number;    // 페이지 내 위치
  blocked?: boolean;       // 차단 감지 여부
}

interface ProductEntry {
  mid: string;             // 상품 MID (고유 ID)
  productName: string;     // 상품명
  totalRank: number;       // 전체 순위
  organicRank: number;     // 오가닉 순위
  isAd: boolean;           // 광고 상품 여부
  pagePosition: number;    // 페이지 내 위치 (1-based)
}
```

### 2. Test Product Collection

**Files:**
- `test/check-all-navertest-items.ts` - slot_navertest 테이블 조회
- `test/insert-all-navertest-keywords.ts` - keywords 테이블 일괄 추가
- `test/check-batch-worker-pool-test.ts` - Worker Pool 기반 병렬 순위 체크

**Workflow:**

```
1. insert-all-navertest-keywords.ts 실행
   ├─ slot_navertest 테이블에서 keyword + link_url 조회
   ├─ keywords_navershopping-test 테이블 초기화
   └─ 전체 키워드 일괄 삽입

2. check-batch-worker-pool-test.ts --workers=4 실행
   ├─ keywords_navershopping-test에서 미처리 항목 조회
   ├─ Worker Pool (4개 브라우저) 생성
   ├─ 각 Worker가 findAccurateRank() 호출
   ├─ 결과를 slot_navertest.current_rank에 업데이트
   └─ 진행률 실시간 출력

3. check-all-navertest-items.ts 실행 (결과 확인)
   ├─ 전체 항목 통계 출력
   ├─ memo 있는 항목 필터링
   └─ 순위 체크 완료 여부 확인
```

### 3. Human Behavior Simulation

**File:** `utils/humanBehavior.ts`

**Functions:**

| Function | Purpose | Parameters |
|----------|---------|------------|
| `humanScroll(page, steps, gapMs)` | 인간형 스크롤 시뮬레이션 | 18단계, 250ms 간격 |
| `humanType(page, selector, text)` | 한 글자씩 타이핑 (100~300ms 랜덤) | 검색창 입력 |

### 4. Parallel Processing

**File:** `batch/check-batch-worker-pool.ts`

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│           Worker Pool Manager                           │
│                                                         │
│  Task Queue: [keyword1, keyword2, ..., keywordN]       │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Worker 1     │  │ Worker 2     │  │ Worker N     │ │
│  │ Browser ctx  │  │ Browser ctx  │  │ Browser ctx  │ │
│  │ + Page       │  │ + Page       │  │ + Page       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                 │                 │          │
│         ▼                 ▼                 ▼          │
│  findAccurateRank()  findAccurateRank()  findAccurateRank()
│         │                 │                 │          │
│         ▼                 ▼                 ▼          │
│  Update DB           Update DB        Update DB       │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 300~400위권 테스트 상품 수집 구현 가이드

### 요구사항

1. **입력:** 메인 키워드 (예: "장난감", "충전기")
2. **출력:** 300~400위권 상품 데이터
   - 상품명 (productName)
   - 상품 URL (link_url)
3. **수집 범위:** 순위 300위 ~ 400위 (약 7~10페이지)

### 구현 전략

#### Option 1: 기존 `collectProductsOnPage()` 확장

```typescript
/**
 * 특정 순위 범위의 상품 수집
 * @param page - Puppeteer/Patchright Page
 * @param keyword - 검색 키워드
 * @param startRank - 시작 순위 (300)
 * @param endRank - 종료 순위 (400)
 * @returns 수집된 상품 리스트
 */
async function collectProductsByRankRange(
  page: Page,
  keyword: string,
  startRank: number = 300,
  endRank: number = 400
): Promise<ProductEntry[]> {

  // 1. 쇼핑탭 진입
  const ready = await enterShoppingTab(page, keyword);
  if (!ready) throw new Error('쇼핑탭 진입 실패');

  // 2. 시작 페이지 계산 (페이지당 ~40개 상품)
  const startPage = Math.floor(startRank / 40) + 1;  // 300 / 40 = 8페이지
  const endPage = Math.ceil(endRank / 40);           // 400 / 40 = 10페이지

  const allProducts: ProductEntry[] = [];

  // 3. 페이지 순회하며 상품 수집
  for (let currentPage = 1; currentPage <= endPage; currentPage++) {
    console.log(`📄 ${currentPage}페이지 수집 중...`);

    if (currentPage === 1) {
      await hydrateCurrentPage(page);
      const scan = await collectProductsOnPage(page, 1);
      allProducts.push(...scan.products);
    } else {
      const products = await goToPageAndGetAPIData(page, currentPage);
      if (products === 'BLOCKED') {
        throw new Error('차단 감지');
      }
      if (products) {
        allProducts.push(...products);
      }
    }

    // 안정화 딜레이
    await delay(5000);

    // 차단 체크
    if (await isBlocked(page)) {
      throw new Error('보안 페이지 감지');
    }
  }

  // 4. 순위 범위 필터링
  const filtered = allProducts.filter(p =>
    p.totalRank >= startRank && p.totalRank <= endRank
  );

  console.log(`✅ ${filtered.length}개 상품 수집 완료 (${startRank}~${endRank}위)`);

  return filtered;
}
```

#### Option 2: Supabase 직접 저장 스크립트

```typescript
// test/collect-test-products.ts
import 'dotenv/config';
import { chromium } from 'patchright';
import { createClient } from '@supabase/supabase-js';
import { collectProductsByRankRange } from '../accurate-rank-checker';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const keyword = process.argv[2] || '장난감';  // CLI 인자로 키워드 받기
  console.log(`🔍 키워드: "${keyword}" (300~400위권 수집)\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 300~400위권 상품 수집
    const products = await collectProductsByRankRange(page, keyword, 300, 400);

    console.log(`\n📊 수집 결과: ${products.length}개\n`);

    // Supabase에 저장
    for (const product of products) {
      const { error } = await supabase
        .from('slot_navertest')
        .insert({
          keyword: keyword,
          link_url: `https://search.shopping.naver.com/catalog/${product.mid}`,
          memo: `${product.totalRank}위 - ${product.productName}`,
          current_rank: product.totalRank,
        });

      if (error) {
        console.error(`❌ 저장 실패 (MID: ${product.mid}):`, error.message);
      } else {
        console.log(`✅ 저장: ${product.totalRank}위 - ${product.productName}`);
      }
    }

    console.log('\n✅ 모든 상품 저장 완료!');

  } catch (error: any) {
    console.error('❌ 에러:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
```

### 실행 방법

```bash
# 테스트 상품 수집 (장난감 키워드)
npx tsx rank-check/test/collect-test-products.ts "장난감"

# 충전기 키워드로 수집
npx tsx rank-check/test/collect-test-products.ts "충전기"

# 수집 결과 확인
npx tsx rank-check/test/check-all-navertest-items.ts
```

---

## 🔧 Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Browser Automation** | Puppeteer | 24.31.0 |
| **Browser Automation** | Patchright (Playwright fork) | 1.57.0 |
| **Database** | Supabase (PostgreSQL) | Latest |
| **Language** | TypeScript | 5.9.3 |
| **Runtime** | Node.js + tsx | 20+ |

---

## 📐 Data Flow

```
1. Input (Keyword + Target MID)
   │
   ▼
2. Browser Launch (Patchright/Puppeteer)
   │
   ▼
3. Navigate to m.naver.com
   │
   ▼
4. Search + Enter Shopping Tab
   │
   ▼
5. Page 1: DOM-based collection
   │  ├─ hydrateCurrentPage() - 18-step scroll
   │  └─ collectProductsOnPage() - Extract from DOM
   │
   ▼
6. Pages 2-15: API Intercept method
   │  ├─ Click pagination button
   │  ├─ Wait for /api/search/all response
   │  ├─ Parse JSON response
   │  └─ Fallback to DOM if API fails
   │
   ▼
7. For each page:
   │  ├─ Extract: MID, productName, rank, isAd
   │  ├─ Check if targetMid found → Return RankResult
   │  ├─ Check if blocked → Return blocked: true
   │  └─ Continue to next page
   │
   ▼
8. Output:
   ├─ RankResult (if found)
   ├─ null (if not found in 15 pages)
   └─ blocked: true (if CAPTCHA detected)
```

---

## 🚨 Bot Detection Avoidance

### Strategies

1. **Human-like Scrolling**
   - 18단계 점진적 스크롤
   - 250ms 간격 (총 4.5초)
   - 랜덤 스크롤 거리 변화

2. **Typing Simulation**
   - 한 글자씩 입력 (100~300ms 랜덤)
   - 백스페이스 확률 5%

3. **Timing Delays**
   - 페이지 전환: 5초 안정화 딜레이
   - 페이지 이동 전: 1~2초 랜덤 딜레이
   - React Hydration 대기: ~4.5초

4. **CAPTCHA Detection**
   - URL 체크: `/authentication`, `/verify`
   - DOM 체크: `.captcha`, `#captcha`
   - 감지 시 즉시 중단 + `blocked: true` 반환

---

## 📊 Database Schema

### `slot_navertest` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary Key |
| `keyword` | text | 검색 키워드 |
| `link_url` | text | 상품 URL |
| `memo` | text | 메모 (순위 정보 등) |
| `current_rank` | integer | 최신 순위 (-1: 미발견, null: 미체크) |
| `created_at` | timestamp | 생성 시각 |
| `updated_at` | timestamp | 업데이트 시각 |

### `keywords_navershopping-test` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary Key |
| `keyword` | text | 검색 키워드 |
| `link_url` | text | 상품 URL |
| `slot_id` | integer | slot_navertest.id (FK) |
| `slot_type` | text | 슬롯 타입 ("네이버test") |
| `status` | text | 처리 상태 (processing/completed/failed) |

---

## ⚙️ Configuration

### Environment Variables

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Browser
HEADLESS=false  # true for production
```

### Constants

```typescript
const SAFE_DELAY_MS = 5000;      // 페이지 안정화 딜레이
const SCROLL_STEPS = 18;         // 스크롤 단계 수
const SCROLL_GAP_MS = 250;       // 스크롤 간격
const MAX_PAGES = 15;            // 최대 추적 페이지 (약 600위)
```

---

## 🎬 Next Steps for Auto-Agent Implementation

### Phase 1: 기본 수집 기능 구현

1. `collectProductsByRankRange()` 함수 추가
2. `test/collect-test-products.ts` 스크립트 작성
3. CLI 인자로 키워드 입력 받기
4. 300~400위권 필터링 로직 구현

### Phase 2: 데이터베이스 통합

1. Supabase 연동 테스트
2. `slot_navertest` 테이블에 자동 저장
3. 중복 체크 로직 추가
4. 실패 시 재시도 메커니즘

### Phase 3: Agent 자동화

1. tRPC API 엔드포인트 생성
2. 스케줄러 연동 (cron)
3. 여러 키워드 일괄 수집
4. 진행률 모니터링 UI

### Phase 4: 고도화

1. IP 로테이션 (프록시 풀)
2. User-Agent 로테이션
3. CAPTCHA 자동 풀이 (2Captcha API)
4. 실패 재시도 전략 최적화

---

**Document Version:** 1.0
**Last Updated:** 2026-01-02
**Generated by:** Claude Code (BMad Document-Project Workflow)
