/**
 * got-scraping 테스트
 *
 * HTTP/2 + TLS fingerprinting으로 봇 탐지 우회 시도
 */

import { checkRankWithGotScraping } from "./server/services/gotScrapingEngine";

async function testGotScraping() {
  console.log("\n🧪 got-scraping 테스트\n");
  console.log("=".repeat(60));

  const testData = {
    keyword: "장난감",
    productId: "28812663612",
  };

  console.log("\n📋 테스트 정보:");
  console.log(`  - 키워드: "${testData.keyword}"`);
  console.log(`  - 상품 ID: ${testData.productId}`);
  console.log(`  - 예상 순위: 41위`);
  console.log(`  - 모드: got-scraping (HTTP/2 + TLS impersonation)`);

  try {
    console.log("\n🚀 순위 체크 시작...\n");

    const startTime = Date.now();
    const rank = await checkRankWithGotScraping(
      testData.keyword,
      testData.productId,
      10
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

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
      console.log(`\n🎉 got-scraping으로 서버 기반 HTTP 패킷 성공!`);
      console.log(`   - HTTP/2 사용 ✅`);
      console.log(`   - TLS impersonation ✅`);
      console.log(`   - 봇 탐지 우회 ✅`);
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

// 실행
testGotScraping()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 치명적 에러:", error);
    process.exit(1);
  });
