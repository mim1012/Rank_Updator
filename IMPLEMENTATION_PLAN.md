# Turafic Dashboard 구현 계획서

**작성일**: 2025-11-16  
**작성자**: Manus AI  
**프로젝트**: Turafic - 네이버 쇼핑 트래픽 자동화 시스템

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [기술 스택](#기술-스택)
4. [Phase 3: Database Schema](#phase-3-database-schema)
5. [Phase 4: 캠페인 관리 시스템](#phase-4-캠페인-관리-시스템)
6. [Phase 5: 안드로이드 봇 에뮬레이터](#phase-5-안드로이드-봇-에뮬레이터)
7. [Phase 6: 작업 큐 시스템](#phase-6-작업-큐-시스템)
8. [Phase 7: Frontend UI](#phase-7-frontend-ui)
9. [Phase 8: 테스트 계획](#phase-8-테스트-계획)
10. [일정 및 마일스톤](#일정-및-마일스톤)

---

## 프로젝트 개요

### 목표

Turafic Dashboard는 네이버 쇼핑 순위 체크 및 트래픽 자동화를 위한 웹 기반 관리 시스템입니다. 제로순위 APK의 리버스 엔지니어링 결과를 바탕으로, 완전히 자동화된 캠페인 관리 및 봇 운영 플랫폼을 구축합니다.

### 핵심 기능

**캠페인 관리**:
- 키워드 및 상품 ID 기반 캠페인 생성
- 10개 변수 설정 (UA, Referer, 쿠키, 딜레이 등)
- 캠페인 상태 모니터링 (활성/일시정지/완료)

**자동화 봇**:
- Puppeteer 기반 브라우저 자동화
- Zero API 통합 (작업 요청/순위 보고)
- 10개 변수를 활용한 HTTP 헤더 생성

**실시간 모니터링**:
- 작업 큐 상태 확인
- 순위 변동 추적
- 에러 로그 및 알림

### 프로젝트 범위

**Phase 3-8**:
1. Database Schema 설계 및 구현
2. Backend API (tRPC) 개발
3. 안드로이드 봇 에뮬레이터 구현
4. 작업 큐 및 순위 체크 로직
5. Frontend UI (React + shadcn/ui)
6. 테스트 및 검증

---

## 시스템 아키텍처

### 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  캠페인 관리  │  │  작업 모니터  │  │  통계 대시보드 │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└───────────────────────────┬─────────────────────────────────┘
                            │ tRPC
┌───────────────────────────┴─────────────────────────────────┐
│                     Backend (Node.js + Express)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Campaign    │  │  Task Queue  │  │  Bot Manager │     │
│  │  Router      │  │  Service     │  │  Service     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Zero API    │  │  HTTP Engine │  │  Naver Bot   │     │
│  │  Client      │  │  (Headers)   │  │  (Puppeteer) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                    Database (MySQL/TiDB)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  campaigns   │  │  tasks       │  │  task_logs   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  Zero API    │  │  Naver       │                        │
│  │  (AWS ELB)   │  │  Shopping    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

```
1. 사용자 → Frontend: 캠페인 생성 (키워드, 상품 ID, 10개 변수)
2. Frontend → Backend: tRPC mutation (campaign.create)
3. Backend → Database: 캠페인 저장
4. Backend → Zero API: 작업 요청 (getKeywordsForRankCheck)
5. Zero API → Backend: KeywordData 응답 (작업 목록 + 쿠키)
6. Backend → Database: 작업 저장 (tasks 테이블)
7. Backend → Bot Manager: 작업 큐에 추가
8. Bot Manager → Naver Bot: Puppeteer 실행
9. Naver Bot → Naver Shopping: 순위 체크
10. Naver Bot → Backend: 순위 결과
11. Backend → Zero API: 순위 보고 (updateKeywordRank)
12. Backend → Database: 작업 완료 상태 업데이트
13. Backend → Frontend: 실시간 업데이트 (WebSocket/SSE)
```

---

## 기술 스택

### Frontend

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19 | UI 프레임워크 |
| TypeScript | 5.x | 타입 안전성 |
| Tailwind CSS | 4 | 스타일링 |
| shadcn/ui | latest | UI 컴포넌트 |
| tRPC | 11 | API 클라이언트 |
| Wouter | latest | 라우팅 |
| TanStack Query | latest | 데이터 페칭 |

### Backend

| 기술 | 버전 | 용도 |
|------|------|------|
| Node.js | 22.x | 런타임 |
| Express | 4.x | 웹 서버 |
| tRPC | 11 | API 프레임워크 |
| Drizzle ORM | latest | 데이터베이스 ORM |
| Puppeteer | latest | 브라우저 자동화 |
| Zod | latest | 스키마 검증 |

### Database

| 기술 | 용도 |
|------|------|
| MySQL 8.0 / TiDB | 메인 데이터베이스 |

### DevOps

| 기술 | 용도 |
|------|------|
| Vite | 빌드 도구 |
| pnpm | 패키지 관리 |
| ESLint | 코드 린팅 |
| Prettier | 코드 포맷팅 |

---

## Phase 3: Database Schema

### 테이블 설계

#### 1. campaigns (캠페인)

**목적**: 캠페인 메타데이터 관리

```sql
CREATE TABLE campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  status ENUM('active', 'paused', 'completed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);
```

#### 2. tasks (작업)

**목적**: 개별 작업 관리 (10개 변수 포함)

```sql
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  keyword_id INT,
  traffic_id INT,
  
  -- 10개 변수
  ua_change INT NOT NULL DEFAULT 1,
  cookie_home_mode INT NOT NULL DEFAULT 1,
  shop_home INT NOT NULL DEFAULT 1,
  use_nid INT NOT NULL DEFAULT 0,
  use_image INT NOT NULL DEFAULT 1,
  work_type INT NOT NULL DEFAULT 3,
  random_click_count INT NOT NULL DEFAULT 2,
  work_more INT NOT NULL DEFAULT 1,
  sec_fetch_site_mode INT NOT NULL DEFAULT 1,
  low_delay INT NOT NULL DEFAULT 2,
  
  -- 상태
  status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
  rank INT,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_status (status)
);
```

#### 3. task_logs (작업 로그)

**목적**: 작업 실행 로그 및 디버깅

```sql
CREATE TABLE task_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  level ENUM('info', 'warning', 'error') DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_task_id (task_id),
  INDEX idx_level (level),
  INDEX idx_created_at (created_at)
);
```

#### 4. naver_cookies (네이버 쿠키)

**목적**: 네이버 쿠키 풀 관리

```sql
CREATE TABLE naver_cookies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nnb VARCHAR(255) NOT NULL,
  nid_aut VARCHAR(255),
  nid_ses VARCHAR(255),
  nid_jkl VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_is_active (is_active),
  INDEX idx_last_used_at (last_used_at)
);
```

### Drizzle Schema

**파일**: `drizzle/schema.ts`

```typescript
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  productId: varchar("product_id", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull(),
  keywordId: int("keyword_id"),
  trafficId: int("traffic_id"),
  
  // 10개 변수
  uaChange: int("ua_change").notNull().default(1),
  cookieHomeMode: int("cookie_home_mode").notNull().default(1),
  shopHome: int("shop_home").notNull().default(1),
  useNid: int("use_nid").notNull().default(0),
  useImage: int("use_image").notNull().default(1),
  workType: int("work_type").notNull().default(3),
  randomClickCount: int("random_click_count").notNull().default(2),
  workMore: int("work_more").notNull().default(1),
  secFetchSiteMode: int("sec_fetch_site_mode").notNull().default(1),
  lowDelay: int("low_delay").notNull().default(2),
  
  // 상태
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  rank: int("rank"),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const taskLogs = mysqlTable("task_logs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id").notNull(),
  level: mysqlEnum("level", ["info", "warning", "error"]).default("info").notNull(),
  message: text("message").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const naverCookies = mysqlTable("naver_cookies", {
  id: int("id").autoincrement().primaryKey(),
  nnb: varchar("nnb", { length: 255 }).notNull(),
  nidAut: varchar("nid_aut", { length: 255 }),
  nidSes: varchar("nid_ses", { length: 255 }),
  nidJkl: varchar("nid_jkl", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type TaskLog = typeof taskLogs.$inferSelect;
export type InsertTaskLog = typeof taskLogs.$inferInsert;
export type NaverCookie = typeof naverCookies.$inferSelect;
export type InsertNaverCookie = typeof naverCookies.$inferInsert;
```

### 마이그레이션

```bash
# 스키마 생성
pnpm db:push

# 마이그레이션 파일 생성
pnpm drizzle-kit generate

# 마이그레이션 실행
pnpm drizzle-kit migrate
```

---

## Phase 4: 캠페인 관리 시스템

### Backend API (tRPC)

**파일**: `server/routers/campaign.ts`

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { campaigns, tasks } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ZeroApiClient } from "../services/zero-api";

export const campaignRouter = router({
  // 캠페인 생성
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      keyword: z.string().min(1).max(255),
      productId: z.string().min(1).max(64),
      
      // 10개 변수 (선택적, 기본값 사용)
      uaChange: z.number().int().min(0).max(1).default(1),
      cookieHomeMode: z.number().int().min(0).max(2).default(1),
      shopHome: z.number().int().min(0).max(4).default(1),
      useNid: z.number().int().min(0).max(1).default(0),
      useImage: z.number().int().min(0).max(1).default(1),
      workType: z.number().int().min(1).max(3).default(3),
      randomClickCount: z.number().int().min(0).max(10).default(2),
      workMore: z.number().int().min(0).max(1).default(1),
      secFetchSiteMode: z.number().int().min(0).max(2).default(1),
      lowDelay: z.number().int().min(1).max(10).default(2),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [campaign] = await db.insert(campaigns).values({
        userId: ctx.user.id,
        name: input.name,
        keyword: input.keyword,
        productId: input.productId,
        status: "active",
      }).$returningId();
      
      return campaign;
    }),
  
  // 캠페인 목록
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, ctx.user.id))
      .orderBy(campaigns.createdAt);
  }),
  
  // 캠페인 상세
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);
      
      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new Error("Campaign not found");
      }
      
      return campaign;
    }),
  
  // 캠페인 시작
  start: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 캠페인 확인
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);
      
      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new Error("Campaign not found");
      }
      
      // Zero API 클라이언트 생성
      const zeroApi = new ZeroApiClient("rank2", "123456789012345");
      
      // 작업 요청
      const keywordData = await zeroApi.getKeywordsForRankCheck();
      
      // 작업 저장
      for (const item of keywordData.data) {
        await db.insert(tasks).values({
          campaignId: campaign.id,
          keywordId: item.keyword_id,
          trafficId: item.traffic_id,
          uaChange: item.ua_change,
          cookieHomeMode: item.cookie_home_mode,
          shopHome: item.shop_home,
          useNid: item.use_nid,
          useImage: item.use_image,
          workType: item.work_type,
          randomClickCount: item.random_click_count,
          workMore: item.work_more,
          secFetchSiteMode: item.sec_fetch_site_mode,
          lowDelay: item.low_delay,
          status: "pending",
        });
      }
      
      return { success: true, taskCount: keywordData.data.length };
    }),
  
  // 캠페인 일시정지
  pause: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db
        .update(campaigns)
        .set({ status: "paused" })
        .where(eq(campaigns.id, input.id));
      
      return { success: true };
    }),
  
  // 캠페인 재개
  resume: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db
        .update(campaigns)
        .set({ status: "active" })
        .where(eq(campaigns.id, input.id));
      
      return { success: true };
    }),
  
  // 캠페인 삭제
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db
        .delete(campaigns)
        .where(eq(campaigns.id, input.id));
      
      return { success: true };
    }),
});
```

### Zero API 클라이언트

**파일**: `server/services/zero-api.ts`

```typescript
import { KeywordData } from "../../shared/types";

const ZERO_API_BASE = "http://api-daae8ace959079d5.elb.ap-northeast-2.amazonaws.com/zero/api";

export class ZeroApiClient {
  constructor(
    private loginId: string,
    private imei: string
  ) {}
  
  async getKeywordsForRankCheck(): Promise<KeywordData> {
    const response = await fetch(
      `${ZERO_API_BASE}/v1/mobile/keywords/naver/rank_check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.loginId,
          imei: this.imei,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Zero API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 0) {
      throw new Error(`Zero API Error: ${data.error?.message || "Unknown error"}`);
    }
    
    return data;
  }
  
  async updateKeywordRank(
    keywordId: number,
    rank: number,
    subRank: number = 0
  ): Promise<void> {
    const response = await fetch(
      `${ZERO_API_BASE}/v1/mobile/keyword/naver/${keywordId}/rank`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.loginId,
          imei: this.imei,
          rank: rank.toString(),
          sub_rank: subRank.toString(),
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Zero API Error: ${response.status} ${response.statusText}`);
    }
  }
  
  async updateProductInfo(
    keywordId: number,
    productName: string
  ): Promise<void> {
    const response = await fetch(
      `${ZERO_API_BASE}/v1/mobile/keyword/naver/${keywordId}/product_info`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.loginId,
          imei: this.imei,
          product_name: productName,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Zero API Error: ${response.status} ${response.statusText}`);
    }
  }
  
  async finishKeyword(
    keywordId: number,
    trafficId: number,
    result: number,
    workCode: number = 0
  ): Promise<void> {
    const response = await fetch(
      `${ZERO_API_BASE}/v1/mobile/keyword/${keywordId}/finish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          login_id: this.loginId,
          imei: this.imei,
          traffic_id: trafficId.toString(),
          result: result.toString(),
          work_code: workCode.toString(),
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Zero API Error: ${response.status} ${response.statusText}`);
    }
  }
}
```

---

## Phase 5: 안드로이드 봇 에뮬레이터

### HTTP 헤더 생성 엔진

**파일**: `server/services/http-engine.ts`

```typescript
import { Task } from "../../drizzle/schema";
import { KeywordData } from "../../shared/types";

export function generateHeaders(
  task: Task,
  keywordData: KeywordData
): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  };
  
  // User-Agent
  if (task.uaChange === 1) {
    headers["User-Agent"] = keywordData.user_agent;
  }
  
  // Referer
  const shopHomeUrls = [
    "https://m.naver.com/",
    "https://msearch.shopping.naver.com/",
    null,
    "https://msearch.shopping.naver.com/di/",
    "https://search.naver.com/search.naver",
  ];
  const referer = shopHomeUrls[task.shopHome];
  if (referer) {
    headers["Referer"] = referer;
  }
  
  // Sec-Fetch-Site
  const secFetchSites = ["none", "same-site", "same-origin"];
  headers["Sec-Fetch-Site"] = secFetchSites[task.secFetchSiteMode];
  headers["Sec-Fetch-Mode"] = "navigate";
  headers["Sec-Fetch-Dest"] = "document";
  
  // sec-ch-ua
  if (task.cookieHomeMode === 1) {
    headers["sec-ch-ua-mobile"] = "?1";
    headers["sec-ch-ua-platform"] = '"Android"';
  } else if (task.cookieHomeMode === 2) {
    headers["sec-ch-ua-mobile"] = "?0";
    headers["sec-ch-ua-platform"] = '"Windows"';
  }
  
  // Cookie
  if (task.useNid === 1 && keywordData.naver_login_cookie) {
    const cookies = [
      `NNB=${keywordData.naver_login_cookie.nnb}`,
      keywordData.naver_login_cookie.nid_aut && `NID_AUT=${keywordData.naver_login_cookie.nid_aut}`,
      keywordData.naver_login_cookie.nid_ses && `NID_SES=${keywordData.naver_login_cookie.nid_ses}`,
      keywordData.naver_login_cookie.nid_jkl && `NID_JKL=${keywordData.naver_login_cookie.nid_jkl}`,
    ].filter(Boolean).join("; ");
    headers["Cookie"] = cookies;
  } else if (keywordData.naver_cookie) {
    headers["Cookie"] = `NNB=${keywordData.naver_cookie.nnb}`;
  }
  
  return headers;
}
```

### Puppeteer 봇

**파일**: `server/services/naver-bot.ts`

```typescript
import puppeteer, { Browser, Page } from "puppeteer";
import { Task, Campaign } from "../../drizzle/schema";
import { KeywordData } from "../../shared/types";
import { generateHeaders } from "./http-engine";

export class NaverShoppingBot {
  private browser: Browser | null = null;
  private page: Page | null = null;
  
  async init() {
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
    
    this.page = await this.browser.newPage();
    
    // 뷰포트 설정 (모바일)
    await this.page.setViewport({
      width: 360,
      height: 640,
      isMobile: true,
    });
  }
  
  async checkRank(
    task: Task,
    campaign: Campaign,
    keywordData: KeywordData
  ): Promise<number> {
    if (!this.page) throw new Error("Bot not initialized");
    
    // 헤더 설정
    const headers = generateHeaders(task, keywordData);
    await this.page.setExtraHTTPHeaders(headers);
    
    // User-Agent 설정
    if (task.uaChange === 1) {
      await this.page.setUserAgent(keywordData.user_agent);
    }
    
    // 이미지 로딩 설정
    if (task.useImage === 0) {
      await this.page.setRequestInterception(true);
      this.page.on("request", (req) => {
        if (req.resourceType() === "image") {
          req.abort();
        } else {
          req.continue();
        }
      });
    }
    
    // 네이버 쇼핑 검색
    const searchUrl = this.buildSearchUrl(campaign.keyword, 1);
    await this.page.goto(searchUrl, { waitUntil: "networkidle2" });
    
    // 딜레이
    await this.delay(task.lowDelay * 1000);
    
    // 순위 검색
    let currentPage = 1;
    const maxPages = 10;
    
    while (currentPage <= maxPages) {
      const rank = await this.findProductRank(campaign.productId, currentPage);
      
      if (rank > 0) {
        return rank;
      }
      
      // 다음 페이지 존재 확인
      const hasNextPage = await this.hasNextPage();
      if (!hasNextPage) {
        break;
      }
      
      // 다음 페이지 이동
      await this.clickNextPage();
      await this.delay(task.lowDelay * 1000);
      
      currentPage++;
    }
    
    return -1; // 순위 없음
  }
  
  private buildSearchUrl(keyword: string, page: number): string {
    const params = new URLSearchParams({
      query: keyword,
      sort: "rel",
      pagingIndex: page.toString(),
      pagingSize: "40",
      viewType: "list",
      productSet: "total",
      origQuery: keyword,
      adQuery: keyword,
    });
    
    return `https://msearch.shopping.naver.com/search/all?${params}`;
  }
  
  private async findProductRank(
    productId: string,
    currentPage: number
  ): Promise<number> {
    if (!this.page) return -1;
    
    const position = await this.page.evaluate((pid) => {
      const selector = `[data-product-id="${pid}"], [data-nv-mid="${pid}"], a[href*="nvMid=${pid}"]`;
      const productNode = document.querySelector(selector);
      
      if (!productNode) return -1;
      
      const allProducts = document.querySelectorAll(".product_item, .product__item, .product_list_item");
      for (let i = 0; i < allProducts.length; i++) {
        if (allProducts[i].querySelector(selector)) {
          return i + 1;
        }
      }
      
      return -1;
    }, productId);
    
    if (position > 0) {
      return (currentPage - 1) * 40 + position;
    }
    
    return -1;
  }
  
  private async hasNextPage(): Promise<boolean> {
    if (!this.page) return false;
    
    return this.page.evaluate(() => {
      const nextButton = document.querySelector(
        ".paginator_btn_next__BE1_y:not(.paginator_disabled__XpDer)"
      );
      return nextButton !== null;
    });
  }
  
  private async clickNextPage(): Promise<void> {
    if (!this.page) return;
    
    await this.page.evaluate(() => {
      const nextButton = document.querySelector(
        ".paginator_btn_next__BE1_y:not(.paginator_disabled__XpDer)"
      ) as HTMLElement;
      nextButton?.click();
    });
    
    await this.page.waitForNavigation({ waitUntil: "networkidle2" });
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
```

---

## Phase 6: 작업 큐 시스템

### Task Router

**파일**: `server/routers/task.ts`

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { tasks, campaigns, taskLogs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { NaverShoppingBot } from "../services/naver-bot";
import { ZeroApiClient } from "../services/zero-api";

export const taskRouter = router({
  // 작업 목록
  list: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      return db
        .select()
        .from(tasks)
        .where(eq(tasks.campaignId, input.campaignId))
        .orderBy(tasks.createdAt);
    }),
  
  // 작업 상세
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);
      
      if (!task) {
        throw new Error("Task not found");
      }
      
      return task;
    }),
  
  // 작업 실행
  execute: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 작업 조회
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);
      
      if (!task) {
        throw new Error("Task not found");
      }
      
      // 캠페인 조회
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, task.campaignId))
        .limit(1);
      
      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new Error("Campaign not found");
      }
      
      // 작업 상태 업데이트
      await db
        .update(tasks)
        .set({ status: "running" })
        .where(eq(tasks.id, input.id));
      
      // 로그 기록
      await db.insert(taskLogs).values({
        taskId: task.id,
        level: "info",
        message: "작업 시작",
        metadata: { campaignId: campaign.id },
      });
      
      try {
        // Zero API 클라이언트 생성
        const zeroApi = new ZeroApiClient("rank2", "123456789012345");
        
        // 작업 요청 (KeywordData 가져오기)
        const keywordData = await zeroApi.getKeywordsForRankCheck();
        
        // 봇 실행
        const bot = new NaverShoppingBot();
        await bot.init();
        
        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "info",
          message: "봇 초기화 완료",
        });
        
        const rank = await bot.checkRank(task, campaign, keywordData);
        
        await bot.close();
        
        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "info",
          message: `순위 체크 완료: ${rank > 0 ? `${rank}위` : "순위 없음"}`,
          metadata: { rank },
        });
        
        // Zero API에 순위 보고
        if (rank > 0 && task.keywordId) {
          await zeroApi.updateKeywordRank(task.keywordId, rank);
          
          await db.insert(taskLogs).values({
            taskId: task.id,
            level: "info",
            message: "순위 보고 완료",
          });
        }
        
        // 작업 완료
        if (task.keywordId && task.trafficId) {
          await zeroApi.finishKeyword(
            task.keywordId,
            task.trafficId,
            rank > 0 ? 1 : 0
          );
        }
        
        // 작업 상태 업데이트
        await db
          .update(tasks)
          .set({
            status: "completed",
            rank: rank > 0 ? rank : null,
          })
          .where(eq(tasks.id, input.id));
        
        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "info",
          message: "작업 완료",
        });
        
        return { success: true, rank };
      } catch (error) {
        // 에러 처리
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        await db
          .update(tasks)
          .set({
            status: "failed",
            errorMessage,
          })
          .where(eq(tasks.id, input.id));
        
        await db.insert(taskLogs).values({
          taskId: task.id,
          level: "error",
          message: `작업 실패: ${errorMessage}`,
          metadata: { error: errorMessage },
        });
        
        throw error;
      }
    }),
  
  // 작업 로그
  logs: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      return db
        .select()
        .from(taskLogs)
        .where(eq(taskLogs.taskId, input.taskId))
        .orderBy(taskLogs.createdAt);
    }),
});
```

### Task Queue Service

**파일**: `server/services/task-queue.ts`

```typescript
import { getDb } from "../db";
import { tasks, campaigns } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { NaverShoppingBot } from "./naver-bot";
import { ZeroApiClient } from "./zero-api";

export class TaskQueueService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => this.processQueue(), 5000);
    
    console.log("[TaskQueue] Started");
  }
  
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log("[TaskQueue] Stopped");
  }
  
  private async processQueue() {
    const db = await getDb();
    if (!db) return;
    
    // pending 상태 작업 조회
    const pendingTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "pending"))
      .limit(1);
    
    if (pendingTasks.length === 0) return;
    
    const task = pendingTasks[0];
    
    try {
      // 작업 실행
      await this.executeTask(task.id);
    } catch (error) {
      console.error(`[TaskQueue] Task ${task.id} failed:`, error);
    }
  }
  
  private async executeTask(taskId: number) {
    const db = await getDb();
    if (!db) return;
    
    // 작업 조회
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    
    if (!task) return;
    
    // 캠페인 조회
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, task.campaignId))
      .limit(1);
    
    if (!campaign) return;
    
    // 작업 상태 업데이트
    await db
      .update(tasks)
      .set({ status: "running" })
      .where(eq(tasks.id, taskId));
    
    console.log(`[TaskQueue] Executing task ${taskId}`);
    
    try {
      // Zero API 클라이언트 생성
      const zeroApi = new ZeroApiClient("rank2", "123456789012345");
      
      // 작업 요청
      const keywordData = await zeroApi.getKeywordsForRankCheck();
      
      // 봇 실행
      const bot = new NaverShoppingBot();
      await bot.init();
      
      const rank = await bot.checkRank(task, campaign, keywordData);
      
      await bot.close();
      
      console.log(`[TaskQueue] Task ${taskId} rank: ${rank}`);
      
      // Zero API에 순위 보고
      if (rank > 0 && task.keywordId) {
        await zeroApi.updateKeywordRank(task.keywordId, rank);
      }
      
      // 작업 완료
      if (task.keywordId && task.trafficId) {
        await zeroApi.finishKeyword(
          task.keywordId,
          task.trafficId,
          rank > 0 ? 1 : 0
        );
      }
      
      // 작업 상태 업데이트
      await db
        .update(tasks)
        .set({
          status: "completed",
          rank: rank > 0 ? rank : null,
        })
        .where(eq(tasks.id, taskId));
      
      console.log(`[TaskQueue] Task ${taskId} completed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      await db
        .update(tasks)
        .set({
          status: "failed",
          errorMessage,
        })
        .where(eq(tasks.id, taskId));
      
      console.error(`[TaskQueue] Task ${taskId} failed:`, errorMessage);
    }
  }
}

// 싱글톤 인스턴스
export const taskQueue = new TaskQueueService();
```

---

## Phase 7: Frontend UI

### 캠페인 목록 페이지

**파일**: `client/src/pages/Campaigns.tsx`

```tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Trash2 } from "lucide-react";
import { useNavigate } from "wouter";

export default function Campaigns() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  
  const { data: campaigns, isLoading } = trpc.campaign.list.useQuery();
  
  const startMutation = trpc.campaign.start.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
    },
  });
  
  const pauseMutation = trpc.campaign.pause.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
    },
  });
  
  const resumeMutation = trpc.campaign.resume.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
    },
  });
  
  const deleteMutation = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
    },
  });
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">캠페인 관리</h1>
          <p className="text-muted-foreground">네이버 쇼핑 순위 체크 캠페인을 관리합니다</p>
        </div>
        <Button onClick={() => navigate("/campaigns/new")}>
          <Plus className="mr-2 h-4 w-4" />
          새 캠페인
        </Button>
      </div>
      
      <div className="grid gap-4">
        {campaigns?.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{campaign.name}</CardTitle>
                  <CardDescription>
                    키워드: {campaign.keyword} | 상품 ID: {campaign.productId}
                  </CardDescription>
                </div>
                <Badge variant={
                  campaign.status === "active" ? "default" :
                  campaign.status === "paused" ? "secondary" :
                  "outline"
                }>
                  {campaign.status === "active" ? "활성" :
                   campaign.status === "paused" ? "일시정지" :
                   "완료"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {campaign.status === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pauseMutation.mutate({ id: campaign.id })}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    일시정지
                  </Button>
                ) : campaign.status === "paused" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resumeMutation.mutate({ id: campaign.id })}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    재개
                  </Button>
                ) : null}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  상세보기
                </Button>
                
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate({ id: campaign.id })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  삭제
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 캠페인 생성 페이지

**파일**: `client/src/pages/CampaignNew.tsx`

```tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "wouter";
import { toast } from "sonner";

export default function CampaignNew() {
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [productId, setProductId] = useState("");
  
  // 10개 변수
  const [uaChange, setUaChange] = useState(1);
  const [cookieHomeMode, setCookieHomeMode] = useState(1);
  const [shopHome, setShopHome] = useState(1);
  const [useNid, setUseNid] = useState(0);
  const [useImage, setUseImage] = useState(1);
  const [workType, setWorkType] = useState(3);
  const [randomClickCount, setRandomClickCount] = useState(2);
  const [workMore, setWorkMore] = useState(1);
  const [secFetchSiteMode, setSecFetchSiteMode] = useState(1);
  const [lowDelay, setLowDelay] = useState(2);
  
  const createMutation = trpc.campaign.create.useMutation({
    onSuccess: () => {
      toast.success("캠페인이 생성되었습니다");
      navigate("/campaigns");
    },
    onError: (error) => {
      toast.error(`캠페인 생성 실패: ${error.message}`);
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createMutation.mutate({
      name,
      keyword,
      productId,
      uaChange,
      cookieHomeMode,
      shopHome,
      useNid,
      useImage,
      workType,
      randomClickCount,
      workMore,
      secFetchSiteMode,
      lowDelay,
    });
  };
  
  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">새 캠페인 생성</h1>
      
      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>캠페인의 기본 정보를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">캠페인 이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 블루투스 키보드 순위 체크"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="keyword">검색 키워드</Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 블루투스 키보드 무선 휴대용"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="productId">상품 ID (MID1)</Label>
              <Input
                id="productId"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="예: 83811414103"
                required
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>고급 설정 (10개 변수)</CardTitle>
            <CardDescription>봇의 동작 방식을 세밀하게 조정할 수 있습니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="uaChange">User-Agent 변경</Label>
              <Select value={uaChange.toString()} onValueChange={(v) => setUaChange(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">기본값</SelectItem>
                  <SelectItem value="1">서버 제공 UA 사용</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="shopHome">진입 URL (Referer)</Label>
              <Select value={shopHome.toString()} onValueChange={(v) => setShopHome(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">네이버 모바일 메인</SelectItem>
                  <SelectItem value="1">네이버 쇼핑 메인</SelectItem>
                  <SelectItem value="3">네이버 쇼핑 디렉토리</SelectItem>
                  <SelectItem value="4">네이버 통합 검색</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="lowDelay">딜레이 시간 (초)</Label>
              <Input
                id="lowDelay"
                type="number"
                min="1"
                max="10"
                value={lowDelay}
                onChange={(e) => setLowDelay(parseInt(e.target.value))}
              />
            </div>
            
            {/* 나머지 변수들... */}
          </CardContent>
        </Card>
        
        <div className="flex gap-2">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "생성 중..." : "캠페인 생성"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/campaigns")}>
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---

## Phase 8: 테스트 계획

### 단위 테스트

**파일**: `server/__tests__/zero-api.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { ZeroApiClient } from "../services/zero-api";

describe("ZeroApiClient", () => {
  it("should request keywords for rank check", async () => {
    const client = new ZeroApiClient("rank2", "123456789012345");
    
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 0,
        data: [
          {
            keyword_id: 896912,
            search: "블루투스 키보드",
            product_id: "83811414103",
            traffic_id: 67890,
            ua_change: 1,
            cookie_home_mode: 1,
            shop_home: 1,
            use_nid: 0,
            use_image: 1,
            work_type: 3,
            random_click_count: 2,
            work_more: 1,
            sec_fetch_site_mode: 1,
            low_delay: 2,
          },
        ],
        user_agent: "Mozilla/5.0...",
        device_ip: "123.456.789.012",
        naver_cookie: {
          nnb: "IJETDRGUTUMGS",
        },
      }),
    });
    
    const result = await client.getKeywordsForRankCheck();
    
    expect(result.status).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].keyword_id).toBe(896912);
  });
});
```

### 통합 테스트

**파일**: `server/__tests__/campaign.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "../routers";
import { createContext } from "../_core/context";

describe("Campaign Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  
  beforeAll(async () => {
    // 테스트 컨텍스트 생성
    const ctx = await createContext({} as any, {} as any);
    caller = appRouter.createCaller(ctx);
  });
  
  it("should create a campaign", async () => {
    const result = await caller.campaign.create({
      name: "Test Campaign",
      keyword: "블루투스 키보드",
      productId: "83811414103",
    });
    
    expect(result).toHaveProperty("id");
  });
  
  it("should list campaigns", async () => {
    const result = await caller.campaign.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});
```

### E2E 테스트

**파일**: `e2e/campaign.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test("should create a campaign", async ({ page }) => {
  await page.goto("http://localhost:5173/campaigns/new");
  
  await page.fill('input[name="name"]', "Test Campaign");
  await page.fill('input[name="keyword"]', "블루투스 키보드");
  await page.fill('input[name="productId"]', "83811414103");
  
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL("http://localhost:5173/campaigns");
  await expect(page.locator("text=Test Campaign")).toBeVisible();
});
```

---

## 일정 및 마일스톤

### 전체 일정

| Phase | 작업 | 예상 소요 시간 | 상태 |
|-------|------|----------------|------|
| 1 | 리버스 엔지니어링 결과 문서화 | 1일 | ✅ 완료 |
| 2 | 프로젝트 계획 수립 | 0.5일 | 🔄 진행 중 |
| 3 | Database Schema 설계 및 구현 | 1일 | ⏳ 대기 |
| 4 | 캠페인 관리 시스템 구현 | 2일 | ⏳ 대기 |
| 5 | 안드로이드 봇 에뮬레이터 구현 | 3일 | ⏳ 대기 |
| 6 | 작업 큐 시스템 구현 | 2일 | ⏳ 대기 |
| 7 | Frontend UI 구현 | 3일 | ⏳ 대기 |
| 8 | 테스트 및 최종 검증 | 2일 | ⏳ 대기 |

**총 예상 소요 시간**: 14.5일

### 마일스톤

**M1: Database 구축 완료** (Phase 3)
- 모든 테이블 생성
- 마이그레이션 실행
- 샘플 데이터 삽입

**M2: Backend API 완성** (Phase 4-6)
- tRPC 라우터 구현
- Zero API 통합
- 봇 시스템 구현
- 작업 큐 시스템 구현

**M3: Frontend 완성** (Phase 7)
- 캠페인 관리 UI
- 작업 모니터링 UI
- 통계 대시보드

**M4: 프로덕션 준비** (Phase 8)
- 모든 테스트 통과
- 문서화 완료
- 배포 준비

---

## 다음 단계

1. **Phase 3 시작**: Database Schema 구현
2. **Phase 4 시작**: 캠페인 관리 시스템 구현
3. **Phase 5 시작**: 안드로이드 봇 에뮬레이터 구현

---

**문서 버전**: 1.0  
**최종 수정일**: 2025-11-16  
**작성자**: Manus AI
