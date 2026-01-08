#!/usr/bin/env npx tsx
/**
 * "키보드" 키워드 300~400위권 상품 100개 수집 및 순위 체크
 *
 * 작업:
 * 1. slot_navertest에 100개 상품 저장 (customer_id: test11, customer_name: test)
 * 2. slot_rank_naver_test_history에 히스토리 기록
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

const KEYWORD = '키보드';
const TARGET_COUNT = 100;
const START_RANK = 300;
const END_RANK = 400;

interface ProductData {
  mid: string;
  productName: string;
  link_url: string;
  totalRank: number;
  isAd: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 300-400위 범위에서 100개 상품 수집
 */
async function collectProducts(page: any): Promise<ProductData[]> {
  console.log(`\n🎯 순위 범위: ${START_RANK}위 ~ ${END_RANK}위 (목표: ${TARGET_COUNT}개)`);

  // 1. 쇼핑탭 진입
  console.log(`\n🧭 키워드 "${KEYWORD}"로 쇼핑탭 진입 중...`);
  const ready = await enterShoppingTab(page, KEYWORD);
  if (!ready) {
    throw new Error('쇼핑탭 진입 실패');
  }
  console.log('✅ 쇼핑탭 진입 완료\n');

  // 2. 페이지 범위 계산 (페이지당 약 40개)
  const startPage = Math.floor((START_RANK - 1) / 40) + 1; // 300 → 8페이지
  const endPage = Math.ceil(END_RANK / 40);                 // 400 → 10페이지

  console.log(`📄 수집 대상 페이지: ${startPage} ~ ${endPage}페이지\n`);

  const allProducts: ProductData[] = [];

  // 3. 페이지 순회하며 상품 수집
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
      // 300-400 범위 필터링
      if (product.totalRank >= START_RANK && product.totalRank <= END_RANK) {
        allProducts.push({
          mid: product.mid,
          productName: product.productName,
          link_url: `https://search.shopping.naver.com/catalog/${product.mid}`,
          totalRank: product.totalRank,
          isAd: product.isAd,
        });

        // 100개 달성 시 즉시 종료
        if (allProducts.length >= TARGET_COUNT) {
          console.log(`\n🎯 목표 달성! ${TARGET_COUNT}개 수집 완료`);
          return allProducts;
        }
      }
    }

    console.log(`   현재까지 수집: ${allProducts.length}개`);

    // 5. 안정화 딜레이 (봇 탐지 회피)
    if (currentPage < endPage && allProducts.length < TARGET_COUNT) {
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

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 수집 완료: ${allProducts.length}개 상품`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return allProducts;
}

/**
 * slot_navertest에 저장
 */
async function saveToSlotNavertest(products: ProductData[]) {
  console.log(`\n💾 slot_navertest에 ${products.length}개 상품 저장 중...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const product of products) {
    const { data, error } = await supabase
      .from('slot_navertest')
      .insert({
        keyword: KEYWORD,
        link_url: product.link_url,
        mid: product.mid,
        product_name: product.productName,
        current_rank: product.totalRank,
        start_rank: product.totalRank,
        customer_id: 'test11',
        customer_name: 'test',
        slot_type: '네이버test',
        workgroup: '공통',
        distributor: '일반',
        memo: `${product.totalRank}위 - ${product.productName.substring(0, 50)}`,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ 저장 실패 (${product.totalRank}위):`, error.message);
      failCount++;
    } else {
      console.log(`   ✅ ID ${data.id} - ${product.totalRank}위: ${product.productName.substring(0, 40)}`);
      successCount++;

      // slot_rank_naver_test_history에도 초기 기록 삽입
      await insertHistory(data.id, product);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 저장 결과: 성공 ${successCount}개 / 실패 ${failCount}개`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * slot_rank_naver_test_history에 히스토리 기록
 */
async function insertHistory(slotStatusId: number, product: ProductData) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('slot_rank_naver_test_history')
    .insert({
      slot_status_id: slotStatusId,
      keyword: KEYWORD,
      link_url: product.link_url,
      current_rank: product.totalRank,
      start_rank: product.totalRank,
      previous_rank: null,
      rank_change: null,
      rank_diff: null,
      start_rank_diff: 0,
      customer_id: 'test11',
      distributor: '일반',
      slot_type: '네이버test',
      rank_date: now,
      created_at: now,
    });

  if (error) {
    console.warn(`      ⚠️ 히스토리 저장 실패 (slot ${slotStatusId}):`, error.message);
  } else {
    console.log(`      📊 히스토리 기록 완료 (slot ${slotStatusId})`);
  }
}

/**
 * 메인 실행
 */
async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎯 키보드 300-400위 상품 100개 수집 시작`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   키워드: "${KEYWORD}"`);
  console.log(`   범위: ${START_RANK}~${END_RANK}위`);
  console.log(`   목표: ${TARGET_COUNT}개`);
  console.log(`   customer_id: test11`);
  console.log(`   customer_name: test`);
  console.log(`   workgroup: 공통`);
  console.log(`   distributor: 일반`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 1. 브라우저 실행
  console.log('🚀 브라우저 실행 중...');

  const userDataDir = path.join(os.tmpdir(), `collect-keyboard-${Date.now()}`);

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const connection = await connect({
    headless: false,
    turnstile: true,
    fingerprint: true,
    customConfig: {
      userDataDir: userDataDir,
    },
  });

  const browser = connection.browser;
  const page = connection.page;

  console.log('✅ 브라우저 준비 완료\n');

  try {
    // 2. 상품 수집
    const products = await collectProducts(page);

    // 3. 결과 출력
    console.log(`\n📊 수집 결과 요약:`);
    console.log(`   총 ${products.length}개 상품`);
    console.log(`   광고 상품: ${products.filter((p) => p.isAd).length}개`);
    console.log(`   오가닉 상품: ${products.filter((p) => !p.isAd).length}개\n`);

    // 4. 샘플 출력 (처음 5개)
    console.log(`샘플 (처음 5개):`);
    products.slice(0, 5).forEach((p) => {
      console.log(`   ${p.totalRank}위 - ${p.productName.substring(0, 50)}`);
      console.log(`         MID: ${p.mid}`);
      console.log(`         URL: ${p.link_url}`);
    });

    if (products.length > 5) {
      console.log(`   ... 외 ${products.length - 5}개\n`);
    }

    // 5. slot_navertest 및 slot_rank_naver_test_history에 저장
    if (products.length > 0) {
      await saveToSlotNavertest(products);
    }

    console.log(`\n✅ 모든 작업 완료!`);
    console.log(`\n다음 단계:`);
    console.log(`  1. slot_navertest 테이블 확인`);
    console.log(`  2. slot_rank_naver_test_history 테이블 확인`);
    console.log(`  3. 순위 체크 실행: npx tsx rank-check/test/check-batch-worker-pool-test.ts\n`);
  } catch (error: any) {
    console.error(`\n❌ 에러 발생:`, error.message);
    process.exit(1);
  } finally {
    await browser.close();
    console.log(`🔚 브라우저 종료\n`);
  }
}

main().catch((error) => {
  console.error('❌ 치명적 에러:', error);
  process.exit(1);
});
