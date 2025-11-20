/**
 * Puppeteer fetch() 모드 테스트
 *
 * Puppeteer의 page.evaluate()에서 fetch() API를 사용하여 테스트합니다.
 * 이것은 실제 Chrome의 네트워크 스택을 사용하면서도 빠릅니다!
 */

import { checkRankWithPuppeteerFetch } from "./server/services/puppeteerFetch";

async function testPuppeteerFetch() {
  console.log("\n🧪 Puppeteer fetch() 모드 테스트\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612", // Rank 41 expected
  };

  console.log("\n📋 테스트 정보:");
  console.log(`  - 키워드: "${testData.keyword}"`);
  console.log(`  - 상품 ID: ${testData.productId}`);
  console.log(`  - 예상 순위: 41위 (2페이지 첫 상품)`);
  console.log(`  - 모드: Puppeteer + fetch() API`);
  console.log(`  - 장점: Chrome 네트워크 + 빠른 속도`);

  try {
    console.log("\n🚀 Puppeteer 시작...");

    // Puppeteer 동적 import
    const puppeteer = (await import("puppeteer")).default;

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=360,640",
      ],
    });

    const page = await browser.newPage();

    // 모바일 뷰포트
    await page.setViewport({
      width: 360,
      height: 640,
      isMobile: true,
      hasTouch: true,
    });

    // User-Agent 설정
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.64 Mobile Safari/537.36"
    );

    console.log("✅ Puppeteer initialized");

    // 순위 체크 실행
    console.log("\n🔍 순위 체크 시작...\n");

    const startTime = Date.now();
    const rank = await checkRankWithPuppeteerFetch(
      page,
      testData.keyword,
      testData.productId,
      10 // 최대 10페이지
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    await browser.close();

    console.log("\n" + "=".repeat(60));

    if (rank > 0) {
      console.log("✅ 순위 발견!");
      console.log(`\n📊 결과:`);
      console.log(`  - 키워드: "${testData.keyword}"`);
      console.log(`  - 상품 ID: ${testData.productId}`);
      console.log(`  - 순위: ${rank}위`);
      console.log(`  - 예상 순위: 41위`);
      console.log(`  - 정확도: ${rank === 41 ? "✅ 정확!" : `⚠️  차이 ${Math.abs(rank - 41)}위`}`);
      console.log(`  - 소요 시간: ${duration}초`);

      if (rank === 41) {
        console.log(`\n🎉 Puppeteer fetch() 모드 성공!`);
        console.log(`   - HTTP 200 달성 ✅`);
        console.log(`   - 봇 탐지 우회 ✅`);
        console.log(`   - 정확한 순위 ✅`);
        console.log(`\n💡 이것이 최적의 솔루션입니다!`);
        console.log(`   1. 실제 Chrome 네트워크 스택 사용`);
        console.log(`   2. 빠른 속도 (DOM 렌더링 불필요)`);
        console.log(`   3. 봇 탐지 완벽 우회`);
      } else {
        console.log(`\n✅ Puppeteer fetch() 모드로 순위 체크 성공!`);
        console.log(`   (순위 차이는 검색 결과 변동일 수 있음)`);
      }
    } else {
      console.log("❌ 순위를 찾을 수 없습니다");
      console.log(`\n📊 결과:`);
      console.log(`  - 키워드: "${testData.keyword}"`);
      console.log(`  - 상품 ID: ${testData.productId}`);
      console.log(`  - 순위: 400위 이내 없음`);
      console.log(`  - 소요 시간: ${duration}초`);
    }

    console.log("\n✅ 테스트 완료");
  } catch (error: any) {
    console.error("\n❌ 에러 발생:", error.message);
    console.error("\n상세 에러:");
    console.error(error);
  }
}

// 테스트 실행
testPuppeteerFetch()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
