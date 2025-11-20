/**
 * 순위 체크만 테스트 (Zero API 없이)
 *
 * 네이버 쇼핑에서 실제로 순위를 불러오는지 확인
 */

import { createNaverBot } from "./server/services/naverBot";

async function testRankCheckOnly() {
  console.log("\n🧪 순위 체크 테스트 (Zero API 없이)\n");
  console.log("=".repeat(60));

  // 테스트 데이터
  const testData = {
    keyword: "장난감",            // 검색할 키워드
    productId: "28812663612",     // 2페이지 첫 상품 (rank 41 예상)
    usePuppeteer: true,           // true = Puppeteer (실제 브라우저)
  };

  console.log("\n📋 테스트 정보:");
  console.log(`  - 키워드: "${testData.keyword}"`);
  console.log(`  - 상품 ID: ${testData.productId}`);
  console.log(`  - 모드: ${testData.usePuppeteer ? "Puppeteer (실제 브라우저)" : "HTTP-only"}`);

  // 10개 변수 (기본값 사용)
  const task = {
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
  };

  console.log("\n🔧 10개 변수 (zru12 기본값):");
  console.log(`  1. ua_change: ${task.uaChange}`);
  console.log(`  2. cookie_home_mode: ${task.cookieHomeMode}`);
  console.log(`  3. shop_home: ${task.shopHome}`);
  console.log(`  4. use_nid: ${task.useNid}`);
  console.log(`  5. use_image: ${task.useImage}`);
  console.log(`  6. work_type: ${task.workType}`);
  console.log(`  7. random_click_count: ${task.randomClickCount}`);
  console.log(`  8. work_more: ${task.workMore}`);
  console.log(`  9. sec_fetch_site_mode: ${task.secFetchSiteMode}`);
  console.log(` 10. low_delay: ${task.lowDelay}`);

  try {
    console.log("\n🚀 순위 체크 시작...");
    console.log("  (최대 10페이지, 400개 상품 검색)");

    const bot = await createNaverBot(testData.usePuppeteer);

    const mockCampaign = {
      keyword: testData.keyword,
      productId: testData.productId,
    };

    const mockKeywordData = {
      user_agent: "Mozilla/5.0 (Linux; Android 8.0.0; SM-G930K Build/R16NW; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.131 Mobile Safari/537.36",
      nnb: "",
      nid_aut: "",
      nid_ses: "",
    };

    const startTime = Date.now();
    const rank = await bot.checkRank(task as any, mockCampaign as any, mockKeywordData);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    await bot.close();

    console.log("\n" + "=".repeat(60));

    if (rank > 0) {
      console.log("✅ 순위 발견!");
      console.log(`\n📊 결과:`);
      console.log(`  - 키워드: "${testData.keyword}"`);
      console.log(`  - 상품 ID: ${testData.productId}`);
      console.log(`  - 순위: ${rank}위`);
      console.log(`  - 소요 시간: ${duration}초`);
      console.log(`\n🎉 네이버 쇼핑에서 순위를 성공적으로 불러왔습니다!`);
    } else {
      console.log("❌ 순위를 찾을 수 없습니다");
      console.log(`\n📊 결과:`);
      console.log(`  - 키워드: "${testData.keyword}"`);
      console.log(`  - 상품 ID: ${testData.productId}`);
      console.log(`  - 순위: 400위 이내 없음`);
      console.log(`  - 소요 시간: ${duration}초`);
      console.log(`\n💡 힌트:`);
      console.log(`  1. 상품 ID가 올바른지 확인하세요`);
      console.log(`  2. 키워드로 검색했을 때 해당 상품이 나오는지 확인하세요`);
      console.log(`  3. 다른 키워드/상품으로 테스트해보세요`);
    }

    console.log("\n✅ 테스트 완료");

  } catch (error: any) {
    console.error("\n❌ 에러 발생:", error.message);
    console.error("\n상세 에러:");
    console.error(error);
  }
}

// 테스트 실행
testRankCheckOnly()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
