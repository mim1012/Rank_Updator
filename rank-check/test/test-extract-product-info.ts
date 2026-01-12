#!/usr/bin/env npx tsx
/**
 * extractProductInfo 유틸리티 테스트
 *
 * 네이버 쇼핑 검색 결과에서 상품 정보 추출이 잘 되는지 테스트합니다.
 *
 * 사용법:
 *   npx tsx rank-check/test/test-extract-product-info.ts
 *
 * 예상 출력:
 *   ✅ 추출 성공률: 70%+
 */

import { connect } from 'puppeteer-real-browser';
import { extractProductInfo } from '../utils/extractProductInfo';

interface TestResult {
  mid: string;
  keyword: string;
  extracted: number;
  total: number;
  fields: {
    keyword_name: boolean;
    price: boolean;
    price_sale: boolean;
    review_count: boolean;
    star_count: boolean;
    month_count: boolean;
    product_image_url: boolean;
  };
}

async function testExtractProductInfo() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 extractProductInfo 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testKeyword = '갤럭시 S24';
  const results: TestResult[] = [];

  try {
    console.log(`🔍 테스트 키워드: "${testKeyword}"\n`);

    // 1. 브라우저 실행
    console.log('1️⃣ 브라우저 시작...');
    const { browser, page } = await connect({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
      customConfig: {},
      turnstile: true,
      disableXvfb: false,
      ignoreAllFlags: false,
    });

    // 2. 네이버 쇼핑 검색
    console.log('2️⃣ 네이버 쇼핑 검색...');
    const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(testKeyword)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 3. 상위 5개 상품의 MID 추출
    console.log('3️⃣ 상품 MID 추출...\n');
    const mids = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="catalog.nv"]'));
      const extractedMids: string[] = [];

      for (const anchor of anchors) {
        const href = (anchor as HTMLAnchorElement).href;
        const match = href.match(/catalog\.nv\?[^"]*catId=([^&"]+)/);
        if (match && extractedMids.length < 5) {
          extractedMids.push(match[1]);
        }
      }

      return extractedMids;
    });

    console.log(`   발견된 MID: ${mids.length}개\n`);

    // 4. 각 MID에 대해 상품 정보 추출 테스트
    console.log('4️⃣ 상품 정보 추출 테스트...\n');
    for (let i = 0; i < mids.length; i++) {
      const mid = mids[i];
      console.log(`[${i + 1}/${mids.length}] MID: ${mid}`);

      const productInfo = await extractProductInfo(page, mid, '   ');

      // 추출된 필드 카운트
      const fields = {
        keyword_name: productInfo.keyword_name !== null,
        price: productInfo.price !== null,
        price_sale: productInfo.price_sale !== null,
        review_count: productInfo.review_count !== null,
        star_count: productInfo.star_count !== null,
        month_count: productInfo.month_count !== null,
        product_image_url: productInfo.product_image_url !== null,
      };

      const extractedCount = Object.values(fields).filter(Boolean).length;

      results.push({
        mid,
        keyword: testKeyword,
        extracted: extractedCount,
        total: 7,
        fields,
      });

      console.log(`   추출: ${extractedCount}/7 필드\n`);
    }

    await browser.close();

    // 5. 결과 집계
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 테스트 결과');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const totalProducts = results.length;
    const totalFields = results.reduce((sum, r) => sum + r.extracted, 0);
    const maxFields = totalProducts * 7;
    const successRate = Math.round((totalFields / maxFields) * 100);

    console.log(`테스트 상품: ${totalProducts}개`);
    console.log(`추출 필드: ${totalFields}/${maxFields}`);
    console.log(`성공률: ${successRate}%\n`);

    // 필드별 성공률
    const fieldStats = {
      keyword_name: 0,
      price: 0,
      price_sale: 0,
      review_count: 0,
      star_count: 0,
      month_count: 0,
      product_image_url: 0,
    };

    results.forEach((r) => {
      Object.keys(r.fields).forEach((key) => {
        if (r.fields[key as keyof typeof r.fields]) {
          fieldStats[key as keyof typeof fieldStats]++;
        }
      });
    });

    console.log('필드별 성공률:');
    Object.entries(fieldStats).forEach(([field, count]) => {
      const rate = Math.round((count / totalProducts) * 100);
      console.log(`   ${field}: ${count}/${totalProducts} (${rate}%)`);
    });

    // 최종 판정
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (successRate >= 60) {
      console.log('✅ 테스트 성공! (성공률 60% 이상)');
    } else {
      console.log('⚠️ 테스트 실패 (성공률 60% 미만)');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ 테스트 에러:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testExtractProductInfo();
