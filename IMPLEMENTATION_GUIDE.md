# Turafic Dashboard 개선 사항 구현 가이드

**문서 버전**: 1.0  
**작성일**: 2025-11-16  
**작성자**: Manus AI  
**기반 문서**: VERIFICATION_REPORT.md

---

## 목차

1. [개요](#1-개요)
2. [Phase 1: 핵심 로직 구현](#2-phase-1-핵심-로직-구현)
3. [Phase 2: Zero API 통합](#3-phase-2-zero-api-통합)
4. [Phase 3: 쿠키 관리](#4-phase-3-쿠키-관리)
5. [Phase 4: Frontend UI 개선](#5-phase-4-frontend-ui-개선)
6. [Phase 5: 테스트 및 최적화](#6-phase-5-테스트-및-최적화)
7. [배포 가이드](#7-배포-가이드)

---

## 1. 개요

### 1.1 목적

본 문서는 **Turafic Dashboard**를 **zru12 APK (제로순위 Updater)**와 동일한 기능을 가진 시스템으로 개선하기 위한 상세 구현 가이드입니다.

### 1.2 전제 조건

- Node.js 22.13.0 이상
- pnpm 패키지 매니저
- MySQL/TiDB 데이터베이스
- Puppeteer 실행 환경 (Chrome/Chromium)

### 1.3 개발 환경 설정

```bash
# 프로젝트 클론
cd /home/ubuntu/turafic-dashboard

# 의존성 설치
pnpm install

# Puppeteer 추가 설치
pnpm add puppeteer

# 개발 서버 실행
pnpm dev
```

---

## 2. Phase 1: 핵심 로직 구현

### 2.1 Database Schema 확장

#### 2.1.1 campaigns 테이블 확장

**파일**: `drizzle/schema.ts`

**변경 사항**:

```typescript
// 기존 코드 (28-38행)
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  platform: mysqlEnum("platform", ["naver", "coupang"]).notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  productId: varchar("productId", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("paused").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

**개선 코드**:

```typescript
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  platform: mysqlEnum("platform", ["naver", "coupang"]).notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  productId: varchar("productId", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("paused").notNull(),
  
  // ✅ 10개 변수 추가
  uaChange: int("ua_change").default(1).notNull(),
  cookieHomeMode: int("cookie_home_mode").default(1).notNull(),
  shopHome: int("shop_home").default(1).notNull(),
  useNid: int("use_nid").default(0).notNull(),
  useImage: int("use_image").default(1).notNull(),
  workType: int("work_type").default(3).notNull(),
  randomClickCount: int("random_click_count").default(2).notNull(),
  workMore: int("work_more").default(1).notNull(),
  secFetchSiteMode: int("sec_fetch_site_mode").default(1).notNull(),
  lowDelay: int("low_delay").default(2).notNull(),
  
  // ✅ 추가 정보
  trafficId: int("traffic_id"),
  adQuery: varchar("ad_query", { length: 255 }),
  origQuery: varchar("orig_query", { length: 255 }),
  sort: varchar("sort", { length: 50 }).default("rel"),
  viewType: varchar("view_type", { length: 50 }).default("list"),
  productSet: varchar("product_set", { length: 50 }).default("total"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
```

#### 2.1.2 tasks 테이블 추가

**파일**: `drizzle/schema.ts` (끝에 추가)

```typescript
// Tasks table (작업 큐)
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  rank: int("rank"),
  errorMessage: text("error_message"),
  retryCount: int("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
```

#### 2.1.3 naverCookies 테이블 추가

**파일**: `drizzle/schema.ts` (끝에 추가)

```typescript
// Naver Cookies table (쿠키 풀)
export const naverCookies = mysqlTable("naver_cookies", {
  id: int("id").autoincrement().primaryKey(),
  nnb: varchar("nnb", { length: 255 }).notNull(),
  susVal: varchar("sus_val", { length: 255 }),
  nidAut: varchar("nid_aut", { length: 255 }),
  nidSes: varchar("nid_ses", { length: 255 }),
  nidJkl: varchar("nid_jkl", { length: 255 }),
  isActive: int("is_active").default(1).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  failureCount: int("failure_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NaverCookie = typeof naverCookies.$inferSelect;
export type InsertNaverCookie = typeof naverCookies.$inferInsert;
```

#### 2.1.4 Database 마이그레이션

```bash
# Schema 변경사항 적용
pnpm db:push

# 또는 마이그레이션 생성
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

### 2.2 HTTP 헤더 생성 엔진

#### 2.2.1 파일 생성

**파일**: `server/utils/headerGenerator.ts`

```typescript
export interface TaskVariables {
  uaChange: number;
  cookieHomeMode: number;
  shopHome: number;
  useNid: number;
  useImage: number;
  workType: number;
  randomClickCount: number;
  workMore: number;
  secFetchSiteMode: number;
  lowDelay: number;
}

export interface HeaderGeneratorConfig {
  task: TaskVariables;
  userAgent?: string;
}

/**
 * 10개 변수를 기반으로 HTTP 헤더 생성
 * zru12 APK의 HttpEngine.genHeader() 로직 재현
 */
export function generateHeaders(config: HeaderGeneratorConfig): Record<string, string> {
  const { task, userAgent } = config;
  const headers: Record<string, string> = {};
  
  // 1. User-Agent
  if (task.uaChange === 1 && userAgent) {
    headers["User-Agent"] = userAgent;
  } else {
    headers["User-Agent"] = getDefaultUserAgent();
  }
  
  // 2. Referer (shop_home 변수 기반)
  const referers = [
    "https://m.naver.com/",                      // 0
    "https://msearch.shopping.naver.com/",       // 1
    null,                                         // 2 (Referer 없음)
    "https://msearch.shopping.naver.com/di/",    // 3
    "https://search.naver.com/search.naver"      // 4
  ];
  const referer = referers[task.shopHome];
  if (referer) {
    headers["Referer"] = referer;
  }
  
  // 3. Sec-Fetch-Site (sec_fetch_site_mode 변수 기반)
  const secFetchSites = ["none", "same-site", "same-origin"];
  headers["Sec-Fetch-Site"] = secFetchSites[task.secFetchSiteMode];
  
  // 4. 기타 고정 헤더
  headers["Sec-Fetch-Mode"] = "navigate";
  headers["Sec-Fetch-Dest"] = "document";
  headers["Sec-Fetch-User"] = "?1";
  headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
  headers["Accept-Language"] = "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7";
  headers["Accept-Encoding"] = "gzip, deflate, br";
  
  // 5. cookie_home_mode가 1이면 sec-ch-ua 헤더 추가
  if (task.cookieHomeMode === 1) {
    headers["sec-ch-ua"] = '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"';
    headers["sec-ch-ua-mobile"] = "?1";
    headers["sec-ch-ua-platform"] = '"Android"';
  }
  
  return headers;
}

/**
 * 기본 User-Agent (Samsung Galaxy S7 + Chrome 92)
 * zru12 APK 분석 결과 기반
 */
function getDefaultUserAgent(): string {
  return "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K Build/R16NW; wv) " +
         "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 " +
         "Chrome/92.0.4515.131 Mobile Safari/537.36";
}

/**
 * User-Agent 풀 (로테이션용)
 */
const USER_AGENT_POOL = [
  // Samsung Galaxy S7
  "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K Build/R16NW; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.131 Mobile Safari/537.36",
  
  // Samsung Galaxy S8
  "Mozilla/5.0 (Linux; Android 9; SM-G950N Build/PPR1.180610.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.131 Mobile Safari/537.36",
  
  // Samsung Galaxy S9
  "Mozilla/5.0 (Linux; Android 10; SM-G960N Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.131 Mobile Safari/537.36",
  
  // Samsung Galaxy S10
  "Mozilla/5.0 (Linux; Android 11; SM-G973N Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.131 Mobile Safari/537.36",
  
  // LG G6
  "Mozilla/5.0 (Linux; Android 9; LG-M700N Build/PKQ1.190414.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.131 Mobile Safari/537.36",
];

/**
 * 랜덤 User-Agent 선택
 */
export function getRandomUserAgent(): string {
  return USER_AGENT_POOL[Math.floor(Math.random() * USER_AGENT_POOL.length)];
}
```

#### 2.2.2 테스트 코드

**파일**: `server/utils/headerGenerator.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { generateHeaders, getRandomUserAgent } from "./headerGenerator";

describe("headerGenerator", () => {
  it("should generate headers with ua_change=1", () => {
    const headers = generateHeaders({
      task: {
        uaChange: 1,
        cookieHomeMode: 1,
        shopHome: 1,
        useNid: 0,
        useImage: 1,
        workType: 3,
        randomClickCount: 2,
        workMore: 1,
        secFetchSiteMode: 1,
        lowDelay: 2,
      },
      userAgent: "Custom User-Agent",
    });
    
    expect(headers["User-Agent"]).toBe("Custom User-Agent");
    expect(headers["Referer"]).toBe("https://msearch.shopping.naver.com/");
    expect(headers["Sec-Fetch-Site"]).toBe("same-site");
  });
  
  it("should generate headers with shop_home=0", () => {
    const headers = generateHeaders({
      task: {
        uaChange: 0,
        cookieHomeMode: 0,
        shopHome: 0,
        useNid: 0,
        useImage: 1,
        workType: 3,
        randomClickCount: 2,
        workMore: 1,
        secFetchSiteMode: 0,
        lowDelay: 2,
      },
    });
    
    expect(headers["Referer"]).toBe("https://m.naver.com/");
    expect(headers["Sec-Fetch-Site"]).toBe("none");
  });
  
  it("should not include Referer when shop_home=2", () => {
    const headers = generateHeaders({
      task: {
        uaChange: 0,
        cookieHomeMode: 0,
        shopHome: 2,
        useNid: 0,
        useImage: 1,
        workType: 3,
        randomClickCount: 2,
        workMore: 1,
        secFetchSiteMode: 1,
        lowDelay: 2,
      },
    });
    
    expect(headers["Referer"]).toBeUndefined();
  });
  
  it("should include sec-ch-ua headers when cookie_home_mode=1", () => {
    const headers = generateHeaders({
      task: {
        uaChange: 0,
        cookieHomeMode: 1,
        shopHome: 1,
        useNid: 0,
        useImage: 1,
        workType: 3,
        randomClickCount: 2,
        workMore: 1,
        secFetchSiteMode: 1,
        lowDelay: 2,
      },
    });
    
    expect(headers["sec-ch-ua"]).toBeDefined();
    expect(headers["sec-ch-ua-mobile"]).toBe("?1");
    expect(headers["sec-ch-ua-platform"]).toBe('"Android"');
  });
  
  it("should return random user agent", () => {
    const ua1 = getRandomUserAgent();
    const ua2 = getRandomUserAgent();
    
    expect(ua1).toBeTruthy();
    expect(ua2).toBeTruthy();
    // 랜덤이므로 항상 다를 수는 없지만, 유효한 UA여야 함
    expect(ua1).toContain("Mozilla");
  });
});
```

---

### 2.3 순위 체크 엔진 (Puppeteer)

#### 2.3.1 파일 생성

**파일**: `server/services/rankChecker.ts`

```typescript
import puppeteer, { Browser, Page } from "puppeteer";

export interface RankCheckConfig {
  keyword: string;
  productId: string;
  maxPages: number;
  lowDelay: number;
  cookies: {
    nnb: string;
    susVal?: string;
    nidAut?: string;
    nidSes?: string;
    nidJkl?: string;
  };
  headers: Record<string, string>;
  sort?: string;
  viewType?: string;
  productSet?: string;
}

export interface RankCheckResult {
  rank: number;
  page: number;
  position: number;
  found: boolean;
}

/**
 * 네이버 쇼핑 순위 체크 엔진
 * zru12 APK의 NaverShopRankAction 로직 재현
 */
export class NaverRankChecker {
  private browser: Browser | null = null;
  
  /**
   * Puppeteer 브라우저 초기화
   */
  async init(): Promise<void> {
    if (this.browser) return;
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });
  }
  
  /**
   * 순위 체크 실행
   */
  async checkRank(config: RankCheckConfig): Promise<RankCheckResult> {
    if (!this.browser) {
      await this.init();
    }
    
    const page = await this.browser!.newPage();
    
    try {
      // User-Agent 설정
      await page.setUserAgent(config.headers["User-Agent"]);
      
      // 쿠키 설정
      await this.setCookies(page, config.cookies);
      
      // 추가 헤더 설정
      await page.setExtraHTTPHeaders(config.headers);
      
      // 이미지 로딩 비활성화 (성능 최적화)
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (request.resourceType() === "image") {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // 순위 체크
      for (let pageNum = 1; pageNum <= config.maxPages; pageNum++) {
        const url = this.buildSearchUrl(config, pageNum);
        
        console.log(`[RankChecker] Checking page ${pageNum}: ${url}`);
        
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        
        // 페이지 로드 대기
        await page.waitForTimeout(1000);
        
        // 상품 목록 추출
        const products = await this.extractProducts(page);
        
        console.log(`[RankChecker] Found ${products.length} products on page ${pageNum}`);
        
        // 타겟 상품 찾기
        const foundIndex = products.findIndex((p) => p.mid1 === config.productId);
        
        if (foundIndex !== -1) {
          const rank = (pageNum - 1) * 40 + foundIndex + 1;
          
          console.log(`[RankChecker] ✅ Found product at rank ${rank} (page ${pageNum}, position ${foundIndex + 1})`);
          
          return {
            rank,
            page: pageNum,
            position: foundIndex + 1,
            found: true,
          };
        }
        
        // 페이지 하단까지 스크롤
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // 딜레이 (low_delay 변수)
        await page.waitForTimeout(config.lowDelay * 1000);
      }
      
      console.log(`[RankChecker] ❌ Product not found in ${config.maxPages} pages`);
      
      return {
        rank: -1,
        page: -1,
        position: -1,
        found: false,
      };
      
    } finally {
      await page.close();
    }
  }
  
  /**
   * 쿠키 설정
   */
  private async setCookies(page: Page, cookies: RankCheckConfig["cookies"]): Promise<void> {
    const cookiesToSet = [
      { name: "NNB", value: cookies.nnb, domain: ".naver.com" },
    ];
    
    if (cookies.susVal) {
      cookiesToSet.push({ name: "sus_val", value: cookies.susVal, domain: ".naver.com" });
    }
    
    if (cookies.nidAut) {
      cookiesToSet.push({ name: "NID_AUT", value: cookies.nidAut, domain: ".naver.com" });
    }
    
    if (cookies.nidSes) {
      cookiesToSet.push({ name: "NID_SES", value: cookies.nidSes, domain: ".naver.com" });
    }
    
    if (cookies.nidJkl) {
      cookiesToSet.push({ name: "NID_JKL", value: cookies.nidJkl, domain: ".naver.com" });
    }
    
    await page.setCookie(...cookiesToSet);
  }
  
  /**
   * 네이버 쇼핑 검색 URL 생성
   */
  private buildSearchUrl(config: RankCheckConfig, page: number): string {
    const params = new URLSearchParams({
      query: config.keyword,
      pagingIndex: page.toString(),
      sort: config.sort || "rel",
      viewType: config.viewType || "list",
      productSet: config.productSet || "total",
    });
    
    return `https://msearch.shopping.naver.com/search/all?${params.toString()}`;
  }
  
  /**
   * 상품 목록 추출 (JavaScript 인젝션)
   * zru12 APK의 NaverShopRankAction.extractProducts() 재현
   */
  private async extractProducts(page: Page): Promise<Array<{ mid1: string; index: number }>> {
    return await page.evaluate(() => {
      const products: Array<{ mid1: string; index: number }> = [];
      
      // 방법 1: data-product-id 속성
      const elements1 = document.querySelectorAll("[data-product-id]");
      elements1.forEach((el, index) => {
        const mid1 = el.getAttribute("data-product-id");
        if (mid1) {
          products.push({ mid1, index });
        }
      });
      
      // 방법 2: data-nclick 속성에서 추출
      if (products.length === 0) {
        const elements2 = document.querySelectorAll("[data-nclick]");
        elements2.forEach((el, index) => {
          const nclick = el.getAttribute("data-nclick");
          if (nclick) {
            const match = nclick.match(/mid1:'(\d+)'/);
            if (match) {
              products.push({ mid1: match[1], index });
            }
          }
        });
      }
      
      // 방법 3: API 응답에서 추출 (window.__PRELOADED_STATE__)
      if (products.length === 0 && (window as any).__PRELOADED_STATE__) {
        const state = (window as any).__PRELOADED_STATE__;
        if (state.products && Array.isArray(state.products)) {
          state.products.forEach((product: any, index: number) => {
            if (product.id) {
              products.push({ mid1: product.id.toString(), index });
            }
          });
        }
      }
      
      return products;
    });
  }
  
  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

#### 2.3.2 테스트 코드

**파일**: `server/services/rankChecker.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NaverRankChecker } from "./rankChecker";

describe("NaverRankChecker", () => {
  let checker: NaverRankChecker;
  
  beforeAll(async () => {
    checker = new NaverRankChecker();
    await checker.init();
  });
  
  afterAll(async () => {
    await checker.close();
  });
  
  it("should find product rank", async () => {
    const result = await checker.checkRank({
      keyword: "갤럭시 S24",
      productId: "83811414103", // 실제 상품 ID
      maxPages: 3,
      lowDelay: 1,
      cookies: {
        nnb: "IJETDRGUTUMGS",
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36",
        "Referer": "https://msearch.shopping.naver.com/",
        "Sec-Fetch-Site": "same-site",
      },
    });
    
    expect(result.found).toBe(true);
    expect(result.rank).toBeGreaterThan(0);
  }, 60000); // 60초 타임아웃
  
  it("should return -1 for non-existent product", async () => {
    const result = await checker.checkRank({
      keyword: "갤럭시 S24",
      productId: "99999999999", // 존재하지 않는 상품 ID
      maxPages: 1,
      lowDelay: 1,
      cookies: {
        nnb: "IJETDRGUTUMGS",
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36",
      },
    });
    
    expect(result.found).toBe(false);
    expect(result.rank).toBe(-1);
  }, 30000);
});
```

---

### 2.4 작업 큐 서비스

#### 2.4.1 파일 생성

**파일**: `server/services/taskQueue.ts`

```typescript
import { getDb } from "../db";
import { tasks, campaigns, naverCookies } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { NaverRankChecker } from "./rankChecker";
import { generateHeaders, getRandomUserAgent } from "../utils/headerGenerator";

/**
 * 작업 큐 서비스
 * zru12 APK의 ActivityMCloud 로직 재현
 */
export class TaskQueueService {
  private isRunning = false;
  private rankChecker: NaverRankChecker;
  
  constructor() {
    this.rankChecker = new NaverRankChecker();
  }
  
  /**
   * 작업 큐 시작
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[TaskQueue] Already running");
      return;
    }
    
    console.log("[TaskQueue] Starting...");
    this.isRunning = true;
    await this.rankChecker.init();
    
    while (this.isRunning) {
      try {
        await this.processNextTask();
      } catch (error) {
        console.error("[TaskQueue] Error processing task:", error);
      }
      
      // 5초 대기 후 다음 작업 처리
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    
    console.log("[TaskQueue] Stopped");
  }
  
  /**
   * 작업 큐 중지
   */
  async stop(): Promise<void> {
    console.log("[TaskQueue] Stopping...");
    this.isRunning = false;
    await this.rankChecker.close();
  }
  
  /**
   * 다음 작업 처리
   */
  private async processNextTask(): Promise<void> {
    const db = await getDb();
    if (!db) {
      console.warn("[TaskQueue] Database not available");
      return;
    }
    
    // pending 상태인 작업 찾기
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "pending"))
      .limit(1);
    
    if (!task) {
      // 작업이 없으면 대기
      return;
    }
    
    console.log(`[TaskQueue] Processing task #${task.id} for campaign #${task.campaignId}`);
    
    // 작업 상태를 running으로 변경
    await db
      .update(tasks)
      .set({ status: "running" })
      .where(eq(tasks.id, task.id));
    
    try {
      // 캠페인 정보 가져오기
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, task.campaignId))
        .limit(1);
      
      if (!campaign) {
        throw new Error(`Campaign #${task.campaignId} not found`);
      }
      
      console.log(`[TaskQueue] Campaign: ${campaign.name} (${campaign.keyword})`);
      
      // HTTP 헤더 생성
      const userAgent = getRandomUserAgent();
      const headers = generateHeaders({
        task: {
          uaChange: campaign.uaChange,
          cookieHomeMode: campaign.cookieHomeMode,
          shopHome: campaign.shopHome,
          useNid: campaign.useNid,
          useImage: campaign.useImage,
          workType: campaign.workType,
          randomClickCount: campaign.randomClickCount,
          workMore: campaign.workMore,
          secFetchSiteMode: campaign.secFetchSiteMode,
          lowDelay: campaign.lowDelay,
        },
        userAgent,
      });
      
      console.log(`[TaskQueue] Generated headers:`, headers);
      
      // 쿠키 가져오기
      const cookies = await this.getCookies(campaign.useNid === 1);
      
      console.log(`[TaskQueue] Using cookies:`, {
        nnb: cookies.nnb,
        susVal: cookies.susVal ? "***" : undefined,
        hasLogin: !!cookies.nidAut,
      });
      
      // 순위 체크
      const result = await this.rankChecker.checkRank({
        keyword: campaign.keyword,
        productId: campaign.productId,
        maxPages: 10,
        lowDelay: campaign.lowDelay,
        cookies,
        headers,
        sort: campaign.sort || "rel",
        viewType: campaign.viewType || "list",
        productSet: campaign.productSet || "total",
      });
      
      console.log(`[TaskQueue] Rank check result:`, result);
      
      // 작업 완료
      await db
        .update(tasks)
        .set({
          status: "completed",
          rank: result.rank,
          completedAt: new Date(),
        })
        .where(eq(tasks.id, task.id));
      
      console.log(`[TaskQueue] ✅ Task #${task.id} completed (rank: ${result.rank})`);
      
    } catch (error) {
      console.error(`[TaskQueue] ❌ Task #${task.id} failed:`, error);
      
      // 에러 처리
      const retryCount = task.retryCount + 1;
      
      if (retryCount < 3) {
        // 재시도
        await db
          .update(tasks)
          .set({
            status: "pending",
            retryCount,
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(tasks.id, task.id));
        
        console.log(`[TaskQueue] Task #${task.id} will be retried (attempt ${retryCount}/3)`);
      } else {
        // 최종 실패
        await db
          .update(tasks)
          .set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          })
          .where(eq(tasks.id, task.id));
        
        console.log(`[TaskQueue] Task #${task.id} failed permanently after 3 attempts`);
      }
    }
  }
  
  /**
   * 쿠키 풀에서 쿠키 가져오기
   */
  private async getCookies(needLogin: boolean): Promise<{
    nnb: string;
    susVal?: string;
    nidAut?: string;
    nidSes?: string;
    nidJkl?: string;
  }> {
    const db = await getDb();
    if (!db) {
      // 기본 쿠키 반환
      return {
        nnb: "IJETDRGUTUMGS",
      };
    }
    
    // 활성화된 쿠키 중 가장 오래 사용되지 않은 것 선택
    const [cookie] = await db
      .select()
      .from(naverCookies)
      .where(eq(naverCookies.isActive, 1))
      .orderBy(naverCookies.lastUsedAt)
      .limit(1);
    
    if (!cookie) {
      // 쿠키가 없으면 기본 쿠키 반환
      return {
        nnb: "IJETDRGUTUMGS",
      };
    }
    
    // 쿠키 사용 시간 업데이트
    await db
      .update(naverCookies)
      .set({ lastUsedAt: new Date() })
      .where(eq(naverCookies.id, cookie.id));
    
    return {
      nnb: cookie.nnb,
      susVal: cookie.susVal || undefined,
      nidAut: needLogin ? cookie.nidAut || undefined : undefined,
      nidSes: needLogin ? cookie.nidSes || undefined : undefined,
      nidJkl: needLogin ? cookie.nidJkl || undefined : undefined,
    };
  }
}
```

#### 2.4.2 서버 시작 시 작업 큐 실행

**파일**: `server/_core/index.ts` (수정)

```typescript
// 기존 코드 끝에 추가

import { TaskQueueService } from "../services/taskQueue";

// 작업 큐 서비스 초기화
const taskQueue = new TaskQueueService();

// 서버 시작 시 작업 큐 시작
taskQueue.start().catch((error) => {
  console.error("[Server] Failed to start task queue:", error);
});

// 서버 종료 시 작업 큐 중지
process.on("SIGINT", async () => {
  console.log("[Server] Shutting down...");
  await taskQueue.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Server] Shutting down...");
  await taskQueue.stop();
  process.exit(0);
});
```

---

## 3. Phase 2: Zero API 통합

### 3.1 Zero API 클라이언트

#### 3.1.1 파일 생성

**파일**: `server/services/zeroApiClient.ts`

```typescript
export interface ZeroApiConfig {
  baseUrl: string;
  loginId: string;
  imei: string;
}

export interface KeywordItem {
  keywordId: number;
  search: string;
  productId: string;
  trafficId: number;
  
  // 10개 변수
  uaChange: number;
  cookieHomeMode: number;
  shopHome: number;
  useNid: number;
  useImage: number;
  workType: number;
  randomClickCount: number;
  workMore: number;
  secFetchSiteMode: number;
  lowDelay: number;
  
  // 추가 정보
  adQuery?: string;
  origQuery?: string;
  sort?: string;
  viewType?: string;
  productSet?: string;
}

export interface NaverCookieData {
  nnb: string;
}

export interface NaverLoginCookieData {
  nnb: string;
  nidAut?: string;
  nidSes?: string;
  nidJkl?: string;
}

export interface KeywordData {
  status: number;
  data: KeywordItem[];
  userAgent: string;
  deviceIp: string;
  naverCookie: NaverCookieData;
  naverLoginCookie?: NaverLoginCookieData;
}

/**
 * Zero API 클라이언트
 * zru12 APK의 NetworkEngine 재현
 */
export class ZeroApiClient {
  private config: ZeroApiConfig;
  
  constructor(config: ZeroApiConfig) {
    this.config = config;
  }
  
  /**
   * 작업 요청
   * POST /v1/mobile/keywords/naver/rank_check
   */
  async getKeywordsForRankCheck(): Promise<KeywordData> {
    const response = await fetch(
      `${this.config.baseUrl}/v1/mobile/keywords/naver/rank_check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.config.loginId,
          imei: this.config.imei,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Zero API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * 순위 보고
   * POST /v1/mobile/keyword/naver/{keywordId}/rank
   */
  async updateKeywordRank(
    keywordId: number,
    rank: number,
    subRank?: number
  ): Promise<void> {
    const body: Record<string, string> = {
      login_id: this.config.loginId,
      imei: this.config.imei,
      rank: rank.toString(),
    };
    
    if (subRank !== undefined) {
      body.sub_rank = subRank.toString();
    }
    
    const response = await fetch(
      `${this.config.baseUrl}/v1/mobile/keyword/naver/${keywordId}/rank`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Zero API error: ${response.status} ${response.statusText}`);
    }
  }
  
  /**
   * 상품 정보 업데이트
   * POST /v1/mobile/keyword/naver/{keywordId}/product_info
   */
  async updateProductInfo(
    keywordId: number,
    productName: string,
    productPrice?: number
  ): Promise<void> {
    const body: Record<string, string> = {
      login_id: this.config.loginId,
      imei: this.config.imei,
      product_name: productName,
    };
    
    if (productPrice !== undefined) {
      body.product_price = productPrice.toString();
    }
    
    const response = await fetch(
      `${this.config.baseUrl}/v1/mobile/keyword/naver/${keywordId}/product_info`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Zero API error: ${response.status} ${response.statusText}`);
    }
  }
  
  /**
   * 작업 완료
   * POST /v1/mobile/keyword/{keywordId}/finish
   */
  async finishKeyword(
    keywordId: number,
    trafficId: number
  ): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/v1/mobile/keyword/${keywordId}/finish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.config.loginId,
          imei: this.config.imei,
          traffic_id: trafficId.toString(),
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Zero API error: ${response.status} ${response.statusText}`);
    }
  }
}
```

#### 3.1.2 환경 변수 설정

**파일**: `.env` (로컬 개발용)

```env
# Zero API 설정
ZERO_API_BASE_URL=http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api
ZERO_API_LOGIN_ID=rank2
ZERO_API_IMEI=123456789012345
```

**파일**: `server/_core/env.ts` (수정)

```typescript
// 기존 코드에 추가

export const ENV = {
  // ... 기존 환경 변수들
  
  // Zero API
  zeroApiBaseUrl: process.env.ZERO_API_BASE_URL || "",
  zeroApiLoginId: process.env.ZERO_API_LOGIN_ID || "",
  zeroApiImei: process.env.ZERO_API_IMEI || "",
} as const;
```

#### 3.1.3 TaskQueueService에 Zero API 통합

**파일**: `server/services/taskQueue.ts` (수정)

```typescript
import { ZeroApiClient } from "./zeroApiClient";
import { ENV } from "../_core/env";

export class TaskQueueService {
  private isRunning = false;
  private rankChecker: NaverRankChecker;
  private zeroApiClient: ZeroApiClient | null = null;
  
  constructor() {
    this.rankChecker = new NaverRankChecker();
    
    // Zero API 클라이언트 초기화 (설정이 있을 때만)
    if (ENV.zeroApiBaseUrl && ENV.zeroApiLoginId && ENV.zeroApiImei) {
      this.zeroApiClient = new ZeroApiClient({
        baseUrl: ENV.zeroApiBaseUrl,
        loginId: ENV.zeroApiLoginId,
        imei: ENV.zeroApiImei,
      });
    }
  }
  
  // ... 기존 코드
  
  private async processNextTask(): Promise<void> {
    // ... 기존 코드 (순위 체크까지)
    
    // 순위 보고 (Zero API)
    if (this.zeroApiClient && campaign.trafficId) {
      try {
        await this.zeroApiClient.updateKeywordRank(campaign.id, result.rank);
        await this.zeroApiClient.finishKeyword(campaign.id, campaign.trafficId);
        console.log(`[TaskQueue] Reported rank to Zero API`);
      } catch (error) {
        console.error(`[TaskQueue] Failed to report to Zero API:`, error);
        // Zero API 실패는 치명적이지 않으므로 계속 진행
      }
    }
    
    // ... 기존 코드 (작업 완료)
  }
}
```

---

## 4. Phase 3: 쿠키 관리

### 4.1 쿠키 시드 데이터

**파일**: `server/scripts/seedCookies.ts`

```typescript
import { getDb } from "../db";
import { naverCookies } from "../../drizzle/schema";

/**
 * 쿠키 시드 데이터 삽입
 */
async function seedCookies() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }
  
  const cookies = [
    {
      nnb: "IJETDRGUTUMGS",
      susVal: "i/DMeSSl8QvYVkq3GLngDk2v",
    },
    // 추가 쿠키...
  ];
  
  for (const cookie of cookies) {
    await db.insert(naverCookies).values(cookie);
  }
  
  console.log(`Inserted ${cookies.length} cookies`);
}

seedCookies().catch(console.error);
```

**실행**:

```bash
pnpm tsx server/scripts/seedCookies.ts
```

### 4.2 쿠키 헬스 체크

**파일**: `server/services/cookieHealthCheck.ts`

```typescript
import { getDb } from "../db";
import { naverCookies } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import puppeteer from "puppeteer";

/**
 * 쿠키 헬스 체크 서비스
 */
export class CookieHealthCheckService {
  /**
   * 모든 쿠키 헬스 체크
   */
  async checkAll(): Promise<void> {
    const db = await getDb();
    if (!db) return;
    
    const allCookies = await db.select().from(naverCookies);
    
    for (const cookie of allCookies) {
      const isValid = await this.checkCookie(cookie.nnb, cookie.susVal || undefined);
      
      if (!isValid) {
        // 쿠키 비활성화
        await db
          .update(naverCookies)
          .set({
            isActive: 0,
            failureCount: cookie.failureCount + 1,
          })
          .where(eq(naverCookies.id, cookie.id));
        
        console.log(`[CookieHealthCheck] Cookie #${cookie.id} is invalid`);
      } else {
        console.log(`[CookieHealthCheck] Cookie #${cookie.id} is valid`);
      }
    }
  }
  
  /**
   * 단일 쿠키 검증
   */
  private async checkCookie(nnb: string, susVal?: string): Promise<boolean> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      // 쿠키 설정
      await page.setCookie(
        { name: "NNB", value: nnb, domain: ".naver.com" },
        ...(susVal ? [{ name: "sus_val", value: susVal, domain: ".naver.com" }] : [])
      );
      
      // 네이버 쇼핑 접근
      const response = await page.goto("https://msearch.shopping.naver.com/search/all?query=test", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      
      // 200 OK이면 유효
      return response?.status() === 200;
      
    } catch (error) {
      return false;
    } finally {
      await browser.close();
    }
  }
}
```

---

## 5. Phase 4: Frontend UI 개선

### 5.1 10개 변수 설정 UI

**파일**: `client/src/pages/Campaigns.tsx` (수정)

캠페인 생성/수정 폼에 10개 변수 입력 필드 추가:

```typescript
// 폼 데이터에 10개 변수 추가
const [formData, setFormData] = useState({
  name: "",
  platform: "naver" as "naver" | "coupang",
  keyword: "",
  productId: "",
  
  // 10개 변수
  uaChange: 1,
  cookieHomeMode: 1,
  shopHome: 1,
  useNid: 0,
  useImage: 1,
  workType: 3,
  randomClickCount: 2,
  workMore: 1,
  secFetchSiteMode: 1,
  lowDelay: 2,
});

// 폼 UI
<div className="grid gap-4">
  {/* 기본 필드 */}
  <div>
    <Label>캠페인 이름</Label>
    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
  </div>
  
  {/* 10개 변수 */}
  <div>
    <Label>User-Agent 변경 (ua_change)</Label>
    <Select value={formData.uaChange.toString()} onValueChange={(v) => setFormData({...formData, uaChange: parseInt(v)})}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">기본 UA</SelectItem>
        <SelectItem value="1">서버 UA</SelectItem>
      </SelectContent>
    </Select>
  </div>
  
  {/* ... 나머지 9개 변수 */}
</div>
```

### 5.2 순위 이력 그래프

**파일**: `client/src/pages/CampaignDetail.tsx` (신규)

```typescript
import { trpc } from "@/lib/trpc";
import { Line } from "react-chartjs-2";

export default function CampaignDetail({ id }: { id: number }) {
  const { data: history } = trpc.rankings.getHistory.useQuery({ campaignId: id });
  
  const chartData = {
    labels: history?.map(h => new Date(h.timestamp).toLocaleDateString()) || [],
    datasets: [
      {
        label: "순위",
        data: history?.map(h => h.rank) || [],
        borderColor: "rgb(75, 192, 192)",
        tension: 0.1,
      },
    ],
  };
  
  return (
    <div>
      <h2>순위 이력</h2>
      <Line data={chartData} />
    </div>
  );
}
```

---

## 6. Phase 5: 테스트 및 최적화

### 6.1 통합 테스트

**파일**: `server/services/integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TaskQueueService } from "./taskQueue";
import { getDb } from "../db";
import { campaigns, tasks } from "../../drizzle/schema";

describe("Integration Test", () => {
  let taskQueue: TaskQueueService;
  
  beforeAll(async () => {
    taskQueue = new TaskQueueService();
  });
  
  afterAll(async () => {
    await taskQueue.stop();
  });
  
  it("should complete full workflow", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // 1. 캠페인 생성
    const [campaign] = await db.insert(campaigns).values({
      name: "테스트 캠페인",
      platform: "naver",
      keyword: "갤럭시 S24",
      productId: "83811414103",
      status: "active",
    }).$returningId();
    
    // 2. 작업 생성
    const [task] = await db.insert(tasks).values({
      campaignId: campaign.id,
      status: "pending",
    }).$returningId();
    
    // 3. 작업 큐 시작
    await taskQueue.start();
    
    // 4. 작업 완료 대기 (최대 60초)
    let completed = false;
    for (let i = 0; i < 60; i++) {
      const [taskResult] = await db.select().from(tasks).where(eq(tasks.id, task.id));
      if (taskResult.status === "completed") {
        completed = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    expect(completed).toBe(true);
  }, 120000);
});
```

---

## 7. 배포 가이드

### 7.1 환경 변수 설정

**프로덕션 환경**:

```env
# Database
DATABASE_URL=mysql://...

# Zero API
ZERO_API_BASE_URL=http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api
ZERO_API_LOGIN_ID=rank2
ZERO_API_IMEI=123456789012345
```

### 7.2 빌드 및 배포

```bash
# 빌드
pnpm build

# 프로덕션 실행
pnpm start
```

---

**문서 끝**
