# 테스트 상품 수집 기능 - 자동 구현 가이드

**Target:** 300~400위권 상품 자동 수집 에이전트
**Input:** 메인 키워드 (예: "장난감", "충전기")
**Output:** 상품명 + URL

---

## 📋 구현 요구사항

### 입력
- **키워드:** 메인 키워드 (예: "장난감", "충전기", "노트북")
- **순위 범위:** 300위 ~ 400위 (고정)

### 출력
- **상품명** (productName): 각 상품의 제목
- **URL** (link_url): `https://search.shopping.naver.com/catalog/{MID}`
- **메타데이터:** 순위, 광고 여부 (선택)

### 제약사항
- 모바일 네이버 쇼핑 (m.naver.com) 사용 필수
- 페이지당 약 40개 상품 → 300~400위는 8~10페이지
- 봇 탐지 회피 필수 (인간 행동 시뮬레이션)
- CAPTCHA 감지 시 즉시 중단

---

## 🚀 Step-by-Step 구현 가이드

### Step 1: 파일 생성

**파일 경로:** `rank-check/test/collect-test-products-by-range.ts`

```typescript
#!/usr/bin/env npx tsx
/**
 * 300~400위권 테스트 상품 자동 수집
 * Usage: npx tsx rank-check/test/collect-test-products-by-range.ts "장난감"
 */
import 'dotenv/config';
import { chromium } from 'patchright';
import { createClient } from '@supabase/supabase-js';
import {
  enterShoppingTab,
  hydrateCurrentPage,
  collectProductsOnPage,
  goToPageAndGetAPIData,
  isBlocked,
} from '../accurate-rank-checker';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// 1. 핵심 수집 함수
// ============================================================

interface ProductData {
  mid: string;
  productName: string;
  link_url: string;
  totalRank: number;
  isAd: boolean;
}

/**
 * 특정 순위 범위의 상품 수집
 * @param page - Patchright Page 객체
 * @param keyword - 검색 키워드
 * @param startRank - 시작 순위 (기본: 300)
 * @param endRank - 종료 순위 (기본: 400)
 * @returns 수집된 상품 배열
 */
async function collectProductsByRankRange(
  page: any,
  keyword: string,
  startRank: number = 300,
  endRank: number = 400
): Promise<ProductData[]> {
  console.log(`\n🎯 순위 범위: ${startRank}위 ~ ${endRank}위`);

  // 1. 쇼핑탭 진입
  console.log(`\n🧭 키워드 "${keyword}"로 쇼핑탭 진입 중...`);
  const ready = await enterShoppingTab(page, keyword);
  if (!ready) {
    throw new Error('쇼핑탭 진입 실패');
  }
  console.log('✅ 쇼핑탭 진입 완료\n');

  // 2. 페이지 범위 계산 (페이지당 약 40개)
  const startPage = Math.floor((startRank - 1) / 40) + 1; // 300 → 8페이지
  const endPage = Math.ceil(endRank / 40);                 // 400 → 10페이지

  console.log(`📄 수집 대상 페이지: ${startPage} ~ ${endPage}페이지\n`);

  const allProducts: ProductData[] = [];

  // 3. 페이지 순회하며 상품 수집
  for (let currentPage = 1; currentPage <= endPage; currentPage++) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 ${currentPage}페이지 수집 중...`);

    let products: any[] = [];

    if (currentPage === 1) {
      // 1페이지: DOM 방식
      await hydrateCurrentPage(page);
      const scan = await collectProductsOnPage(page, 1);
      products = scan.products;
      console.log(`   ✅ ${products.length}개 상품 수집 (DOM 방식)`);
    } else {
      // 2페이지 이상: API 인터셉트 방식
      const result = await goToPageAndGetAPIData(page, currentPage);

      if (result === 'BLOCKED') {
        console.error('   🛑 차단 감지! 수집 중단');
        throw new Error('보안 페이지 감지 - 차단됨');
      }

      if (result) {
        products = result;
        console.log(`   ✅ ${products.length}개 상품 수집 (API 방식)`);
      } else {
        console.warn(`   ⚠️ ${currentPage}페이지 수집 실패, 건너뜀`);
      }
    }

    // 4. 수집한 상품을 전체 리스트에 추가
    for (const product of products) {
      allProducts.push({
        mid: product.mid,
        productName: product.productName,
        link_url: `https://search.shopping.naver.com/catalog/${product.mid}`,
        totalRank: product.totalRank,
        isAd: product.isAd,
      });
    }

    console.log(`   현재까지 수집: ${allProducts.length}개`);

    // 5. 안정화 딜레이 (봇 탐지 회피)
    if (currentPage < endPage) {
      const delayMs = 5000 + Math.random() * 2000; // 5~7초 랜덤
      console.log(`   ⏳ ${(delayMs / 1000).toFixed(1)}초 대기 중...`);
      await delay(delayMs);
    }

    // 6. 차단 체크
    if (await isBlocked(page)) {
      console.error('   🛑 보안 페이지 감지! 즉시 중단');
      throw new Error('CAPTCHA 또는 보안 페이지 감지');
    }
  }

  // 7. 순위 범위 필터링
  const filtered = allProducts.filter(
    (p) => p.totalRank >= startRank && p.totalRank <= endRank
  );

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 필터링 완료: ${filtered.length}개 상품 (${startRank}~${endRank}위)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return filtered;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 2. Supabase 저장 함수
// ============================================================

async function saveToSupabase(keyword: string, products: ProductData[]) {
  console.log(`💾 Supabase에 ${products.length}개 상품 저장 중...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const product of products) {
    const { error } = await supabase.from('slot_navertest').insert({
      keyword: keyword,
      link_url: product.link_url,
      memo: `${product.totalRank}위 - ${product.productName.substring(0, 50)}`,
      current_rank: product.totalRank,
    });

    if (error) {
      console.error(`   ❌ 저장 실패 (${product.totalRank}위):`, error.message);
      failCount++;
    } else {
      console.log(`   ✅ 저장: ${product.totalRank}위 - ${product.productName.substring(0, 40)}`);
      successCount++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 저장 결과: 성공 ${successCount}개 / 실패 ${failCount}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// ============================================================
// 3. 메인 실행 함수
// ============================================================

async function main() {
  // CLI 인자로 키워드 받기
  const keyword = process.argv[2];

  if (!keyword) {
    console.error('❌ 키워드를 입력하세요!');
    console.log('\n사용법:');
    console.log('  npx tsx rank-check/test/collect-test-products-by-range.ts "장난감"');
    console.log('  npx tsx rank-check/test/collect-test-products-by-range.ts "충전기"\n');
    process.exit(1);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 테스트 상품 수집 시작`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   키워드: "${keyword}"`);
  console.log(`   범위: 300~400위`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 1. 브라우저 실행
  console.log('🚀 브라우저 실행 중...');
  const browser = await chromium.launch({
    headless: false, // 디버깅 시 true로 변경
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR',
  });

  const page = await context.newPage();
  console.log('✅ 브라우저 준비 완료\n');

  try {
    // 2. 상품 수집 실행
    const products = await collectProductsByRankRange(page, keyword, 300, 400);

    // 3. 결과 출력
    console.log(`\n📊 수집 결과 요약:`);
    console.log(`   총 ${products.length}개 상품`);
    console.log(`   광고 상품: ${products.filter((p) => p.isAd).length}개`);
    console.log(`   오가닉 상품: ${products.filter((p) => !p.isAd).length}개\n`);

    // 4. 샘플 출력 (처음 5개)
    console.log(`샘플 (처음 5개):`);
    products.slice(0, 5).forEach((p) => {
      console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 50)}`);
      console.log(`         URL: ${p.link_url}`);
    });

    if (products.length > 5) {
      console.log(`   ... 외 ${products.length - 5}개\n`);
    }

    // 5. Supabase 저장
    if (products.length > 0) {
      await saveToSupabase(keyword, products);
    }

    console.log(`\n✅ 모든 작업 완료!`);
  } catch (error: any) {
    console.error(`\n❌ 에러 발생:`, error.message);
    process.exit(1);
  } finally {
    await browser.close();
    console.log(`🔚 브라우저 종료\n`);
  }
}

// ============================================================
// 4. 실행
// ============================================================

main().catch((error) => {
  console.error('❌ 치명적 에러:', error);
  process.exit(1);
});
```

---

## 🎯 실행 방법

### 1. 단일 키워드 수집

```bash
# 장난감 키워드로 300~400위 수집
npx tsx rank-check/test/collect-test-products-by-range.ts "장난감"

# 충전기 키워드로 수집
npx tsx rank-check/test/collect-test-products-by-range.ts "충전기"

# 노트북 키워드로 수집
npx tsx rank-check/test/collect-test-products-by-range.ts "노트북"
```

### 2. 여러 키워드 일괄 수집 (스크립트 작성)

**파일:** `rank-check/test/collect-multiple-keywords.ts`

```typescript
#!/usr/bin/env npx tsx
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const keywords = ['장난감', '충전기', '노트북', '마우스', '키보드'];

async function main() {
  for (const keyword of keywords) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 키워드: "${keyword}" 수집 시작`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const { stdout, stderr } = await execAsync(
        `npx tsx rank-check/test/collect-test-products-by-range.ts "${keyword}"`
      );

      console.log(stdout);
      if (stderr) console.error(stderr);

      console.log(`✅ "${keyword}" 수집 완료\n`);
    } catch (error: any) {
      console.error(`❌ "${keyword}" 수집 실패:`, error.message);
    }

    // 키워드 간 10초 대기 (봇 탐지 회피)
    if (keywords.indexOf(keyword) < keywords.length - 1) {
      console.log(`⏳ 다음 키워드까지 10초 대기...\n`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ 모든 키워드 수집 완료!`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(console.error);
```

**실행:**

```bash
npx tsx rank-check/test/collect-multiple-keywords.ts
```

---

## 📊 예상 출력

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 테스트 상품 수집 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   키워드: "장난감"
   범위: 300~400위
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 브라우저 실행 중...
✅ 브라우저 준비 완료

🎯 순위 범위: 300위 ~ 400위

🧭 키워드 "장난감"로 쇼핑탭 진입 중...
✅ 쇼핑탭 진입 완료

📄 수집 대상 페이지: 8 ~ 10페이지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 1페이지 수집 중...
   ✅ 40개 상품 수집 (DOM 방식)
   현재까지 수집: 40개
   ⏳ 5.8초 대기 중...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 2페이지 수집 중...
   ✅ 40개 상품 수집 (API 방식)
   현재까지 수집: 80개
   ⏳ 6.2초 대기 중...

... (3~7페이지 생략)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 8페이지 수집 중...
   ✅ 40개 상품 수집 (API 방식)
   현재까지 수집: 320개
   ⏳ 5.3초 대기 중...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 9페이지 수집 중...
   ✅ 40개 상품 수집 (API 방식)
   현재까지 수집: 360개
   ⏳ 6.7초 대기 중...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 10페이지 수집 중...
   ✅ 40개 상품 수집 (API 방식)
   현재까지 수집: 400개

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 필터링 완료: 101개 상품 (300~400위)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 수집 결과 요약:
   총 101개 상품
   광고 상품: 12개
   오가닉 상품: 89개

샘플 (처음 5개):
   300위 - 레고 클래식 대형 조립박스 10698
         URL: https://search.shopping.naver.com/catalog/12345678
   301위 - 타요 버스 장난감 세트
         URL: https://search.shopping.naver.com/catalog/23456789
   302위 - 공룡 피규어 12종 세트
         URL: https://search.shopping.naver.com/catalog/34567890
   ... 외 98개

💾 Supabase에 101개 상품 저장 중...

   ✅ 저장: 300위 - 레고 클래식 대형 조립박스 10698
   ✅ 저장: 301위 - 타요 버스 장난감 세트
   ✅ 저장: 302위 - 공룡 피규어 12종 세트
   ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 저장 결과: 성공 101개 / 실패 0개
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 모든 작업 완료!
🔚 브라우저 종료
```

---

## 🧪 테스트 검증

### 1. 수집 결과 확인

```bash
# Supabase에 저장된 데이터 확인
npx tsx rank-check/test/check-all-navertest-items.ts
```

### 2. 예상 결과

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 통계
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  전체: 101개
  memo 있음: 101개
  순위 있음: 101개
  미발견(-1): 0개
  미체크: 0개
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID        순위        keyword           memo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1         300        장난감            300위 - 레고 클래식 대형 조립박스
2         301        장난감            301위 - 타요 버스 장난감 세트
3         302        장난감            302위 - 공룡 피규어 12종 세트
...
101       400        장난감            400위 - 미니 자동차 장난감
```

---

## 🚨 에러 처리

### 1. 차단 감지 시

```
🛑 차단 감지! 수집 중단
❌ 에러 발생: 보안 페이지 감지 - 차단됨
```

**대응 방안:**
- IP 변경 (프록시 사용)
- User-Agent 변경
- 1시간 후 재시도

### 2. API 인터셉트 실패 시

```
⚠️ 9페이지 API 실패, DOM 방식으로 폴백...
✅ DOM 방식으로 38개 상품 수집
```

**자동 폴백:** API 실패 시 자동으로 DOM 방식으로 전환

### 3. 페이지 수집 실패 시

```
⚠️ 8페이지 수집 실패, 건너뜀
```

**안전 처리:** 해당 페이지를 건너뛰고 다음 페이지 계속 수집

---

## 🎬 Next Steps

### Phase 1: 기본 기능 구현 ✅
- [x] `collectProductsByRankRange()` 함수
- [x] CLI 인자로 키워드 입력
- [x] Supabase 자동 저장
- [x] 에러 처리 및 로깅

### Phase 2: 고도화
- [ ] 여러 키워드 일괄 수집 배치 작업
- [ ] 진행률 UI (웹 대시보드)
- [ ] 실패 재시도 메커니즘
- [ ] 수집 결과 Excel 내보내기

### Phase 3: Agent 통합
- [ ] tRPC API 엔드포인트 생성
- [ ] 스케줄러 연동 (node-cron)
- [ ] 알림 기능 (이메일/Slack)
- [ ] 데이터 분석 및 리포트 자동 생성

---

**Document Version:** 1.0
**Last Updated:** 2026-01-02
**Ready for Implementation:** ✅ YES
