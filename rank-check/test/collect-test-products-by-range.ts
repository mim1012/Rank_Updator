#!/usr/bin/env npx tsx
/**
 * 300~400위권 테스트 상품 자동 수집
 * Usage: npx tsx rank-check/test/collect-test-products-by-range.ts "장난감"
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
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

  // 3. 페이지 순회하며 상품 수집 (startPage부터 endPage까지)
  for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
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
      customer_id: 'test',         // 테스트 수집용 기본값
      customer_name: '테스트수집',
      slot_type: '네이버test',
      mid: product.mid,
      product_name: product.productName,
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

  // 1. 브라우저 실행 (puppeteer-real-browser 사용)
  console.log('🚀 브라우저 실행 중...');

  const userDataDir = path.join(os.tmpdir(), `collect-products-${Date.now()}`);

  // userDataDir 폴더 생성 (없으면 에러 발생)
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const connection = await connect({
    headless: false,
    turnstile: true,      // Cloudflare Turnstile 우회
    fingerprint: true,    // 브라우저 핑거프린팅 방지
    customConfig: {
      userDataDir: userDataDir,
    },
  });

  const browser = connection.browser;
  const page = connection.page;

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
