# 데이터 흐름 시각화 문서

**버전**: 1.1
**작성일**: 2025-12-29

이 문서는 네이버 쇼핑 순위 체크 시스템의 실행 스크립트와 데이터 흐름을 시각화합니다.

---

## 1. 스크립트 목록

### 1.1 메인 실행 스크립트 (현재 사용)

| 파일 | 설명 | 실행 방법 |
|------|------|----------|
| `batch/check-batch-worker-pool.ts` | **메인 진입점** - 워커 풀 배치 처리 | `npx tsx rank-check/batch/check-batch-worker-pool.ts` |
| `parallel/parallel-rank-checker.ts` | **핵심 로직** - ProductId 방식 순위 체크 | (라이브러리) |
| `launcher/auto-update-launcher.ts` | 런처 - 작업 감시 모드 | `.\bin\naverrank-launcher.exe` |
| `launcher/bootstrap-launcher.ts` | 부트스트랩 런처 | (내부 사용) |

### 1.2 유틸리티

| 파일 | 설명 |
|------|------|
| `utils/save-rank-to-slot-naver.ts` | Supabase 저장 (slot_naver, history) |
| `utils/ipRotation.ts` | IP 로테이션 (차단 회피) |
| `utils/humanBehavior.ts` | 휴먼 행동 시뮬레이션 (타이핑, 스크롤) |
| `utils/ReceiptCaptchaSolver.ts` | 영수증 캡챠 자동 해결 (Claude Vision) |

### 1.3 레거시 (MID 방식) - 참고용

| 파일 | 설명 |
|------|------|
| `accurate-rank-checker.ts` | MID 기반 순위 체크 (레거시) |
| `utils/url-to-mid-converter.ts` | URL → MID 변환 (레거시) |
| `utils/getCatalogMidFromUrl.ts` | 카탈로그 MID 추출 (레거시) |

### 1.4 테스트/디버그

| 파일 | 설명 |
|------|------|
| `test/check-batch-worker-pool-test.ts` | 워커 풀 테스트 |
| `test/save-rank-to-slot-naver-test.ts` | 저장 로직 테스트 |
| `test/check-keywords-test.ts` | 키워드 조회 테스트 |
| `test/reset-processing.ts` | 처리중 상태 초기화 |

### 1.5 폴더 구조

```
rank-check/
├── batch/                         # 배치 실행 스크립트
│   └── check-batch-worker-pool.ts    ⭐ 메인 진입점
│
├── parallel/                      # 병렬 처리
│   └── parallel-rank-checker.ts      ⭐ ProductId 순위 체크 핵심
│
├── launcher/                      # 런처
│   ├── auto-update-launcher.ts       작업 감시 런처
│   └── bootstrap-launcher.ts         부트스트랩
│
├── utils/                         # 유틸리티
│   ├── save-rank-to-slot-naver.ts    DB 저장
│   ├── ipRotation.ts                 IP 로테이션
│   ├── humanBehavior.ts              휴먼 시뮬레이션
│   └── ReceiptCaptchaSolver.ts       캡챠 해결
│
├── test/                          # 테스트 스크립트
├── legacy/                        # 레거시 (사용 안함)
├── single/                        # 단일 테스트 (개발용)
└── examples/                      # 예제
```

---

## 2. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              실행 진입점                                      │
│                    check-batch-worker-pool.ts                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Supabase                                        │
│  ┌─────────────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │keywords_navershopping│  │  slot_naver  │  │slot_rank_naver_history │    │
│  │     (작업 큐)        │  │ (현재 순위)   │  │      (순위 이력)        │    │
│  └─────────────────────┘  └──────────────┘  └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ParallelRankChecker                                  │
│                    parallel-rank-checker.ts                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Worker 0 │  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │                   │
│  │(Browser) │  │(Browser) │  │(Browser) │  │(Browser) │                   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                      ┌─────────────────────────┐
                      │    ProductId 방식       │
                      │  checkRankByProductId() │
                      │                         │
                      │ 1. URL에서 productId 추출│
                      │ 2. 네이버 메인 → 검색   │
                      │ 3. 쇼핑탭 이동          │
                      │ 4. DOM에서 순위 매칭    │
                      └─────────────────────────┘
                                    │
                                    ▼
                         ┌───────────────────┐
                         │ 네이버 쇼핑 검색   │
                         │ search.shopping.  │
                         │   naver.com       │
                         └───────────────────┘
```

---

## 3. 메인 실행 흐름 (ProductId 방식)

```
check-batch-worker-pool.ts (진입점)
│
├── 1. claimKeywords()
│   └── Supabase RPC: claim_keywords
│       └── keywords_navershopping에서 pending/waiting 작업 가져오기
│
├── 2. new ParallelRankChecker()
│   └── checkUrlsWithWorkerPool(requests, 4, onResult)
│       │
│       └── Worker 0~3 (병렬 실행)
│           └── checkSingleUrl()
│               │
│               ├── isSmartStoreUrl() → true (대부분)
│               │   │
│               │   ├── extractProductIdFromUrl()
│               │   │   └── URL에서 /products/(\d+) 추출
│               │   │
│               │   └── checkRankByProductId()
│               │       ├── enterShoppingTabForProductId()
│               │       │   ├── naver.com 진입
│               │       │   ├── humanType() - 키워드 입력
│               │       │   └── 쇼핑탭 클릭
│               │       │
│               │       ├── [페이지 1~15 순회]
│               │       │   ├── hydrateCurrentPage() - 스크롤
│               │       │   ├── findRankByProductIdOnPage()
│               │       │   │   └── data-shp-contents-dtl에서 chnl_prod_no 매칭
│               │       │   └── goToNextPageForProductId()
│               │       │
│               │       └── 결과 반환
│               │           { rank, catalogNvMid, productName, isAd, blocked }
│               │
│               └── isSmartStoreUrl() → false (레거시 fallback)
│                   └── urlToMid() + findAccurateRank()
│
└── 3. processResult() (onResult 콜백)
    ├── 차단 감지 시 → rotateIP()
    ├── 순위 발견 시 → saveRankToSlotNaver()
    │   ├── slot_naver UPDATE/INSERT
    │   └── slot_rank_naver_history INSERT
    └── keywords_navershopping DELETE
```

---

## 4. 파일 의존성 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        check-batch-worker-pool.ts                            │
│                              (진입점)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
         │              │                │                │
         ▼              ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│parallel-rank│  │save-rank-to │  │ ipRotation  │  │  @supabase  │
│-checker.ts  │  │-slot-naver  │  │    .ts      │  │  /supabase  │
│             │  │    .ts      │  │             │  │    -js      │
│ ⭐ 핵심     │  │             │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     parallel-rank-checker.ts                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ProductId 방식 (메인)                                   │    │
│  │  • isSmartStoreUrl()                                    │    │
│  │  • extractProductIdFromUrl()                            │    │
│  │  • checkRankByProductId()                               │    │
│  │    ├── enterShoppingTabForProductId()                   │    │
│  │    ├── hydrateCurrentPage()                             │    │
│  │    ├── findRankByProductIdOnPage()                      │    │
│  │    └── goToNextPageForProductId()                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  레거시 fallback (카탈로그 URL용)                        │    │
│  │  • urlToMid() → getCatalogMidFromUrl()                  │    │
│  │  • findAccurateRank()                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│ humanBehavior.ts    │
│                     │
│ • humanScroll()     │
│ • humanType()       │
└─────────────────────┘
```

---

## 5. 핵심 함수 상세

### 5.1 checkRankByProductId() - ProductId 순위 체크

```
┌─────────────────────────────────────────────────────────────────┐
│  parallel-rank-checker.ts:267                                    │
│  checkRankByProductId(page, keyword, productId, logPrefix)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 쇼핑탭 진입 - enterShoppingTabForProductId()                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. page.goto('https://www.naver.com/')                   │    │
│  │ 2. input[name="query"] 대기                              │    │
│  │ 3. humanType(page, keyword) - 사람처럼 타이핑            │    │
│  │ 4. Enter 키                                              │    │
│  │ 5. a[href*="search.shopping.naver.com"] 클릭             │    │
│  │ 6. URL 확인: search.shopping.naver.com                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 페이지 순회 (1~15페이지)                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ for (currentPage = 1; currentPage <= 15; currentPage++) │    │
│  │                                                         │    │
│  │   // 스크롤로 lazy loading 트리거                        │    │
│  │   hydrateCurrentPage(page)                              │    │
│  │     └── humanScroll(page, 18 * 550)                     │    │
│  │                                                         │    │
│  │   // DOM에서 productId 매칭                              │    │
│  │   findRankByProductIdOnPage(page, productId)            │    │
│  │     └── data-shp-contents-dtl의 chnl_prod_no 비교       │    │
│  │                                                         │    │
│  │   // 다음 페이지 이동                                    │    │
│  │   goToNextPageForProductId(page, currentPage + 1)       │    │
│  │     └── 페이지네이션 버튼 클릭 + API 응답 대기           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 결과 반환                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 매칭 성공 시:                                            │    │
│  │ {                                                        │    │
│  │   rank: (page - 1) * 40 + pageRank,  // 실제 순위       │    │
│  │   catalogNvMid: "12345678901",       // 카탈로그 MID    │    │
│  │   productName: "상품명",                                 │    │
│  │   page: 3,                                               │    │
│  │   isAd: false,                                           │    │
│  │   blocked: false                                         │    │
│  │ }                                                        │    │
│  │                                                         │    │
│  │ 미발견 시: { rank: null, error: "15페이지까지 미발견" }  │    │
│  │ 차단 시:   { rank: null, blocked: true }                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 findRankByProductIdOnPage() - DOM에서 순위 찾기

```
┌─────────────────────────────────────────────────────────────────┐
│  parallel-rank-checker.ts:146                                    │
│  findRankByProductIdOnPage(page, targetProductId)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  page.evaluate() 내부 로직                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ // 모든 상품 앵커 선택                                    │    │
│  │ const anchors = document.querySelectorAll(               │    │
│  │   'a[data-shp-contents-id][data-shp-contents-rank]'     │    │
│  │     [data-shp-contents-dtl]'                             │    │
│  │ );                                                       │    │
│  │                                                         │    │
│  │ for (const anchor of anchors) {                         │    │
│  │   // MID (10자리 이상)                                   │    │
│  │   const mid = anchor.getAttribute('data-shp-contents-id');│   │
│  │                                                         │    │
│  │   // data-shp-contents-dtl JSON 파싱                    │    │
│  │   const dtl = anchor.getAttribute('data-shp-contents-dtl');│  │
│  │   const parsed = JSON.parse(dtl);                       │    │
│  │                                                         │    │
│  │   // chnl_prod_no가 targetProductId와 매칭되면          │    │
│  │   for (const item of parsed) {                          │    │
│  │     if (item.key === 'chnl_prod_no' &&                  │    │
│  │         item.value === targetProductId) {               │    │
│  │       return {                                          │    │
│  │         found: true,                                    │    │
│  │         pageRank: parseInt(rankStr),                    │    │
│  │         catalogNvMid: ...,                              │    │
│  │         productName: ...,                               │    │
│  │         isAd: /lst\*(A|P|D)/.test(inventory)            │    │
│  │       };                                                │    │
│  │     }                                                   │    │
│  │   }                                                     │    │
│  │ }                                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 saveRankToSlotNaver() - DB 저장

```
┌─────────────────────────────────────────────────────────────────┐
│  save-rank-to-slot-naver.ts:49                                   │
│  saveRankToSlotNaver(supabase, keyword, rankResult)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1단계: slot_naver 레코드 검색 (우선순위)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ① slot_id로 검색                                        │    │
│  │ ② slot_sequence + slot_type으로 검색                    │    │
│  │ ③ keyword + link_url + slot_type으로 검색               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2단계: slot_naver UPDATE 또는 INSERT                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ UPDATE slot_naver SET                                    │    │
│  │   current_rank = 45,                                     │    │
│  │   mid = '12345678901',  // ← ProductId에서 얻은 값       │    │
│  │   product_name = '상품명',                               │    │
│  │   updated_at = NOW()                                     │    │
│  │ WHERE id = ?                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3단계: slot_rank_naver_history INSERT                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ INSERT INTO slot_rank_naver_history                      │    │
│  │ (slot_status_id, keyword, current_rank, previous_rank,   │    │
│  │  rank_change, start_rank_diff, rank_date)                │    │
│  │ VALUES (...)                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. DOM 구조 (네이버 쇼핑)

### 6.1 상품 데이터 속성

```html
<!-- 각 상품 아이템 -->
<a data-shp-contents-id="12345678901"     <!-- nvMid (카탈로그 ID) -->
   data-shp-contents-rank="15"            <!-- 페이지 내 순위 -->
   data-shp-inventory="lst*N"             <!-- 광고 여부: A/P/D=광고, N=오가닉 -->
   data-shp-contents-dtl='[
     {"key":"chnl_prod_no","value":"12345678"},  <!-- ⭐ productId (매칭 키) -->
     {"key":"catalog_nv_mid","value":"12345678901"},
     {"key":"prod_nm","value":"상품명"}
   ]'>
   ...
</a>
```

### 6.2 ProductId 매칭 로직

```
URL: https://smartstore.naver.com/store/products/12345678
                                                ^^^^^^^^
                                                productId

DOM: data-shp-contents-dtl='[{"key":"chnl_prod_no","value":"12345678"}, ...]'
                                                            ^^^^^^^^
                                                            chnl_prod_no

매칭: productId === chnl_prod_no → 순위 발견!
```

---

## 7. 데이터베이스 테이블

```
┌─────────────────────────────┐
│   keywords_navershopping    │  ← 작업 큐 (처리 후 삭제)
├─────────────────────────────┤
│ id, keyword, link_url       │
│ slot_id, slot_sequence      │
│ status: pending → processing│
│ worker_id, started_at       │
└─────────────────────────────┘
              │
              │ 순위 체크 완료
              ▼
┌─────────────────────────────┐
│        slot_naver           │  ← 현재 순위
├─────────────────────────────┤
│ id, keyword, link_url       │
│ mid (productId/catalogMid)  │
│ current_rank, start_rank    │
│ product_name                │
└─────────────────────────────┘
              │
              │ 이력 저장
              ▼
┌─────────────────────────────┐
│ slot_rank_naver_history     │  ← 순위 이력 (append-only)
├─────────────────────────────┤
│ slot_status_id (FK)         │
│ current_rank, previous_rank │
│ rank_change, start_rank_diff│
│ rank_date                   │
└─────────────────────────────┘
```

---

## 8. 에러 처리

### 8.1 차단 감지

```
isBlocked(page) 체크:
  - "보안 확인" 텍스트
  - "자동 입력 방지" 텍스트
  - "일시적으로 제한" 텍스트

연속 5회 차단 → rotateIP() → 15초 대기
```

### 8.2 타임아웃 복구

```
recoverStaleKeywords():
  - status='processing' AND started_at < 30분 전
  → status='pending', worker_id=null
```

---

## 9. 실행 방법

```bash
# 기본 실행 (4 워커)
npx tsx rank-check/batch/check-batch-worker-pool.ts

# 워커 수 지정
npx tsx rank-check/batch/check-batch-worker-pool.ts --workers=2

# 처리 개수 제한
npx tsx rank-check/batch/check-batch-worker-pool.ts --limit=50

# 런처 (Windows)
.\bin\naverrank-launcher.exe
```

---

**작성자**: Claude Code
**마지막 업데이트**: 2025-12-29
