#!/usr/bin/env npx tsx
/**
 * slot_navertest의 키보드 상품을 상품명으로 검색하여 순위 및 nv_mid 검증
 *
 * 동작:
 * 1. slot_navertest에서 keyword='키보드' 상품들 조회
 * 2. 각 상품의 product_name으로 네이버 검색
 * 3. 쇼핑탭에서 실제 순위 및 nv_mid 추출
 * 4. 저장된 값과 비교
 */
import 'dotenv/config';
import { connect } from 'puppeteer-real-browser';
import { createClient } from '@supabase/supabase-js';
import { enterShoppingTab, hydrateCurrentPage, collectProductsOnPage } from '../accurate-rank-checker';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SlotProduct {
  id: number;
  keyword: string;
  product_name: string;
  mid: string;
  current_rank: number;
  link_url: string;
}

interface VerificationResult {
  slot_id: number;
  product_name: string;
  stored_mid: string;
  stored_rank: number;
  found: boolean;
  actual_mid: string | null;
  actual_rank: number | null;
  match: boolean;
  error?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * slot_navertest에서 키보드 상품 조회 (상품명이 있는 것만)
 */
async function getKeyboardProducts(limit: number = 10): Promise<SlotProduct[]> {
  console.log(`\n📋 slot_navertest에서 키보드 상품 조회 중...\n`);

  const { data, error } = await supabase
    .from('slot_navertest')
    .select('id, keyword, product_name, mid, current_rank, link_url')
    .eq('keyword', '키보드')
    .not('product_name', 'is', null)
    .neq('product_name', '')
    .order('current_rank')
    .limit(limit);

  if (error) {
    console.error(`❌ 조회 실패:`, error);
    return [];
  }

  console.log(`✅ ${data.length}개 상품 조회 완료\n`);
  return data as SlotProduct[];
}

/**
 * 상품명으로 검색하여 순위 및 MID 찾기
 */
async function verifyProductByName(
  page: any,
  product: SlotProduct
): Promise<VerificationResult> {
  const result: VerificationResult = {
    slot_id: product.id,
    product_name: product.product_name,
    stored_mid: product.mid,
    stored_rank: product.current_rank,
    found: false,
    actual_mid: null,
    actual_rank: null,
    match: false,
  };

  try {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔍 검색: "${product.product_name.substring(0, 50)}"`);
    console.log(`   저장된 MID: ${product.mid}`);
    console.log(`   저장된 순위: ${product.current_rank}위\n`);

    // 1. 상품명으로 쇼핑탭 진입
    const ready = await enterShoppingTab(page, product.product_name);
    if (!ready) {
      result.error = '쇼핑탭 진입 실패';
      console.log(`   ❌ 쇼핑탭 진입 실패\n`);
      return result;
    }

    await delay(3000);

    // 2. 상품 수집
    await hydrateCurrentPage(page);
    const scan = await collectProductsOnPage(page, 1);

    console.log(`   📦 수집: ${scan.products.length}개 상품`);

    // 3. 저장된 MID와 매칭
    const foundProduct = scan.products.find((p) => p.mid === product.mid);

    if (foundProduct) {
      result.found = true;
      result.actual_mid = foundProduct.mid;
      result.actual_rank = foundProduct.totalRank;
      result.match = foundProduct.mid === product.mid;

      console.log(`   ✅ 발견: ${foundProduct.totalRank}위`);
      console.log(`   📊 MID: ${foundProduct.mid} ${result.match ? '(일치)' : '(불일치)'}`);

      if (foundProduct.isAd) {
        console.log(`   🎯 광고 상품`);
      }
    } else {
      result.error = '1페이지에서 미발견';
      console.log(`   ⚠️ 1페이지에서 찾을 수 없음`);

      // 상위 5개 상품 출력 (디버깅용)
      console.log(`   📋 상위 5개 상품:`);
      scan.products.slice(0, 5).forEach((p, idx) => {
        console.log(`      ${idx + 1}. ${p.mid} - ${p.productName.substring(0, 40)}`);
      });
    }

    console.log(``);
    return result;

  } catch (error: any) {
    result.error = error.message;
    console.log(`   ❌ 에러: ${error.message}\n`);
    return result;
  }
}

/**
 * 메인 실행
 */
async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 키보드 상품 검증 (상품명 검색)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   전략: 상품명으로 검색 → 쇼핑탭에서 순위/MID 추출`);
  console.log(`   대상: slot_navertest (keyword='키보드')`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 1. 키보드 상품 조회
  const products = await getKeyboardProducts(10); // 상위 10개만

  if (products.length === 0) {
    console.log(`❌ 검증할 상품이 없습니다.`);
    console.log(`\n다음 명령으로 먼저 상품을 수집하세요:`);
    console.log(`   npx tsx rank-check/test/collect-keyboard-300-400-final.ts\n`);
    return;
  }

  console.log(`📊 검증 대상:`);
  products.forEach((p, idx) => {
    console.log(`   ${idx + 1}. [${p.current_rank}위] ${p.product_name.substring(0, 50)}`);
    console.log(`      MID: ${p.mid}`);
  });

  // 2. 브라우저 실행
  console.log(`\n🚀 브라우저 실행 중...\n`);

  const userDataDir = path.join(os.tmpdir(), `verify-keyboard-${Date.now()}`);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const connection = await connect({
    headless: false,
    turnstile: true,
    fingerprint: true,
    customConfig: { userDataDir },
  });

  const browser = connection.browser;
  const page = connection.page;

  const results: VerificationResult[] = [];

  try {
    // 3. 각 상품 검증
    for (const product of products) {
      const result = await verifyProductByName(page, product);
      results.push(result);

      // 안정화 딜레이 (봇 탐지 회피)
      await delay(5000 + Math.random() * 3000);
    }

    // 4. 결과 요약
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 검증 결과 요약`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const foundCount = results.filter((r) => r.found).length;
    const matchCount = results.filter((r) => r.match).length;
    const notFoundCount = results.filter((r) => !r.found).length;

    console.log(`   전체: ${results.length}개`);
    console.log(`   ✅ 발견: ${foundCount}개`);
    console.log(`   🎯 MID 일치: ${matchCount}개`);
    console.log(`   ❌ 미발견: ${notFoundCount}개\n`);

    // 5. 상세 결과
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 상세 결과`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    results.forEach((r, idx) => {
      const status = r.found ? (r.match ? '✅ 일치' : '⚠️ 불일치') : '❌ 미발견';
      console.log(`${idx + 1}. ${status}`);
      console.log(`   상품명: ${r.product_name.substring(0, 50)}`);
      console.log(`   저장 MID: ${r.stored_mid} (${r.stored_rank}위)`);

      if (r.found) {
        console.log(`   실제 MID: ${r.actual_mid} (${r.actual_rank}위)`);

        if (r.stored_rank !== r.actual_rank) {
          const diff = r.actual_rank! - r.stored_rank;
          const arrow = diff > 0 ? '📉' : '📈';
          console.log(`   ${arrow} 순위 변동: ${diff > 0 ? '+' : ''}${diff}`);
        }
      } else {
        console.log(`   사유: ${r.error || '알 수 없음'}`);
      }

      console.log(``);
    });

    // 6. 권장 사항
    if (notFoundCount > 0) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`💡 권장 사항`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      console.log(`   미발견 상품이 있습니다. 다음을 확인하세요:`);
      console.log(`   1. 상품명이 정확한지 확인`);
      console.log(`   2. 상품이 품절/삭제되었는지 확인`);
      console.log(`   3. 검색 키워드를 조정해야 할 수 있음\n`);
    }

  } catch (error: any) {
    console.error(`\n❌ 에러 발생:`, error.message);
    process.exit(1);
  } finally {
    await browser.close();
    console.log(`🔚 테스트 완료\n`);
  }
}

main().catch((error) => {
  console.error('❌ 치명적 에러:', error);
  process.exit(1);
});
